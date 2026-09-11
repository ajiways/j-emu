# Combat

## Статус

Есть hunt melee loop (raw-AMF L/C/R, delay grant/bot-counter, kill, waiter
re-pair), map `joinHunt`, CMB-02 pocket/glove/rage casts, CMB-03 terminal
settlement, CMB-04 reconnect/ghost/RESURRECT, CMB-05 STR-урон, CMB-06
bot spell book, CMB-07 loot, CMB-08 friendly duel + hunt 3↔3 waiter
handoff и GEAR-01 RAM kind-3 с надетой 20546 (raw-AMF). Cross-swap двух
живых пар и CEF дуэли/shuffle/gear-spell не прогонялись — product status
combat остаётся частично. CMB-09 отдаёт
quest `on_win`/`on_lose` через `FightTerminalObserver` (unit). AREA leftover
`START_FIGHT` и hunt loot-cap — composition (`QuestDesk` /
`HuntFightSettlement`), не combat domain. Roster/flags квестового боя —
leftover.

## Источники поведения

Основной lifecycle:

- `jgr-emu/docs/FIGHT_MODEL.md`;
- `jgr-emu/docs/FIGHT_CAST_ACK.md`;
- `jgr-emu/docs/FIGHT_LOOT.md`;
- `jgr-emu/docs/FIGHT_RECONNECT.md`;
- `jgr-emu/docs/FIGHT_TOASTS.md`.

Механики: `FIGHT_TURN_UI`, `FIGHT_RAGE`, `FIGHT_JOIN`, `FIGHT_LOCK`, `POCKET`,
`GLOVE_MAGIC`, `BOT_SPELLS`, `GEAR_SPELL`.

`FIGHT_DAMAGE` и `FIGHT_MAGIC` содержат empirical/invented formulas. При
переносе они получают явную метку `legacy behavior`, не live parity.

## Runtime model

Active combat целиком process-local:

- participants, teams, HP, turns, effects и RNG state;
- command and outbound packet queues;
- ephemeral bot IDs от `1_000_000`.

PostgreSQL выдаёт fight ID, но не хранит active fight. Finished history
записывается best-effort на 72 часа и не является source of truth результата.
CMB-03 пишет HP/EXP/loot через character/inventory ports после RAM finish;
combat tables героя не трогает.

CHR-02 читает только `ActiveFightQuery.isHeroInActiveFight(characterId)` через
account-keyed `CombatPort.activeFightId`. `CombatService` держит один RAM
`Battle` на fight id и несколько accounts; карта ATTACK_BOT на занятую живую
точку вызывает `joinHunt` team 1.

## Wire lifecycle

Текущий hunt flow:

1. ATTACK_BOT сначала `syncResources` (боя ещё нет), затем создаёт battle и
   возвращает `fight|conf` и unitframe с overlay `hp_time=0`.
2. `fight|conf.proxy` — live URL `https://s1.jugger.ru/fproxy//;`. CEF шлёт
   poll и `auth` на HTTPS `/fproxy//;`. Процесс также слушает TCP `:33120`
   (policy + length-prefixed AMF) как запасной путь. HTTP `auth` паркует
   bootstrap в очередь; следующий poll отдаёт `{rs}` + `{ev: fightState…oppnew}`
   - `{ev: attacknow}`. Auth/strike будят account-scoped waiters.
3. Melee poll: leading `attackwait` + `cast` → `{rs,sq}`; bot `cast` ~1400 ms
   позже; standalone `attacknow` ~2500 ms только кастеру.
4. Pocket/glove/rage: HTTP `castSpell` пустой; poll `{rs,sq}` **до** FX для
   `srcType` 2/3 и native 6/7. Melee L/C/R остаётся strike-then-rs.
5. Terminal: `fightFinish` на fproxy; CMB-03 добавляет esrv `fight|loot` затем
   `fight|exit` в одном `2:` object после composition UoW (HP/EXP/money/loot).

Inventory layout lock (`PUT_ON`/`PUT_OFF`/`DROP`/`SELL` → `203` в бою) —
именованное `FightRules` в [INVENTORY.md](INVENTORY.md), не live. Live
[FIGHT_LOCK.md](../../../jgr-emu/docs/FIGHT_LOCK.md) эти коды не режет.
Трата из кармана — fproxy. World USE, COME_IN/`common|exit` и ATTACK — live
`fightBusy`; WLD-01 применяет то же `FightRules` `203`. Карта ATTACK_BOT:
ключ — spawn id; занятая живая точка — `joinHunt` team 1. OA `FIGHT_JOIN` /
`FIGHT_HELP` — SOC-03 (hunt team 1, same-area, dump 204). Live `10_000_000 + heroes.id` в `userId` не копировать
— participant = `heroes.id`.

SINGLE/MULTI framing, exact `sq`, source IDs и packet order менять нельзя.

Критический client-side behavior:

- pocket/glove: успешный `rs` идёт до strike, иначе клиент дважды списывает
  count/cost;
- melee ending: strike идёт до `rs`;
- rage `srcId:6` и aggro `srcId:7` также требуют `rs` до strike;
- glove combo списывает `cp - cost`, а не обнуляет CP;
- unsupported targetless spell возвращает HTTP restriction, а не fake poll
  success;
- turn grant очищается до resolving killing strike.

## CMB-01 — melee turn loop

Срез реализован: `CombatDelay` (`dueAt` + cancel по fight id), синхронный
`Battle`, `HuntMeleeScheduler` + `CombatMeleeLoop`. Production
`SystemCombatDelay` будит fproxy waiters; тесты — `MutableClock` +
`ManualCombatDelay`, без `sleep`. `Clock.schedule` нет. Урон CMB-05 —
`STR/10 ±15%` (`legacy behavior`), не min/max под Gryzl.

Join/waiter WLD-02 не ломается: пока A в дуэли, B без `attacknow`/`oppnew`.
Если A умер и бот жив — authed B получает `oppnew`, затем `attacknow`.

Player melee и ending glove бьют `FightDuel.otherId`, а не `Battle.kind`.
Цель — живой human в паре или hunt bot; иначе fail-fast. После удара
bot-counter ставится только если opponent — бот, иначе grant этому human.
`Battle.kind` остаётся для bootstrap, join, practice settlement и history,
не для формулы удара. Hybrid (люди и боты в обеих командах) ещё не playable
slice; finish — когда на стороне цели не осталось живых.

CEF (кнопки после паузы, скрытие на свой удар) в этом срезе не прогонялся.

### Wire

Melee `srcType:1`, `srcId` 1/2/3 = L/C/R. HTTP `castSpell` пустой.
Успешный ending melee в **одном** poll: leading `{et:attackwait}` + `cast`
(`attack_left|center|right`) → соседний `{rs,sq}`. Нет `attacknow` и нет
удара бота в этом MULTI.

Потом bot `cast` `attack_center` (~1400 ms). Потом standalone
`{et:attacknow, restTime}` (~2500 ms) только кастеру.

Kill: `cancel(fightId)` **до** resolve; poll `attackwait`+`cast` `react=10`
и `fightFinish`; leftover `attacknow` нет.

Off-turn / waiter / already-ended: пустой HTTP + poll `{rs:true}` без HP.
Не `restriction:18` и не fproxy `error`.

## CMB-02 — pocket / glove / rage

Срез закрыт (raw-AMF). `startHunt`/`joinHunt` принимают immutable loadout
(pocket + надетая перчатка или пусто). Снимок собирает `jugger-wire`
`HuntCombatLoadout` из inventory/catalog ports; domain combat не импортирует
их repositories. Combat RAM держит count/cp/rage. Fproxy HTTPS: decode →
combat cast → `takePocketConsume` → inventory `consumePocket` только после
успеха, в `UnitOfWork`. TCP fproxy не персистит карман: pending consume —
ошибка (production путь — HTTPS).

HTTP `castSpell` на успех пустой. Карман 93/99, ярость 6, агро 7, keep-turn
перчатка: `{rs,sq}` первым в том же poll, потом FX. Ending glove: rs затем
strike с leading `attackwait`. Off-turn ending: `{rs:true}` + абсолютный
`persCP`. 93 CD deny: HTTP `{rs:false}` без `restriction`. 99: `cast ev:[]`,
без `persSpells` в FX. 6: rs затем fury. 7: rs затем абсолютный `count`.
Melee L/C/R остаётся strike-then-rs.

Content: dump-proven `spell` у **93** (хил, CD 20) и **99** (орб `ev:[]`);
**9095** сокеты **9098/9100/9099**. 77 без fight blob. Нет `srcId:5` в
fproxy, нет 77 в бою, нет generic effect engine. AOE ending (`targetCount===2`)
урон `16` — `legacy behavior`, не `FIGHT_DAMAGE`. Kind 11 HTTP
`{rs:false, restriction:18}` — только если опубликованный spell kind 11
(в текущем slice нет). CEF счётчиков пояса/перчатки/ярости не прогонялся.

## CMB-03 — terminal settlement

Срез закрыт (raw-AMF). Composition `HuntFightSettlement` после RAM finish:
одна UoW (`noteHp`, `grantExperience` если ≥ 1, `creditMoney`, `grantToBag`,
`refillPocketAfterFight`), затем history best-effort, затем esrv
`fight|loot` затем `fight|exit`. Combat не пишет `heroes`/`items`. Catalog
бот 2: `baseExp` 15, money 0.2–0.44, `lootNothingWeight` 3460 (= 3000 + 460
неопубликованных overlay-весов), entries 77/93/99. `leaveFight` HTTP
`{rs:true}`; last human — flee `type:2` без лута; союзник жив — только
flee-exit, бой продолжается. Loss: HP 0, loot-блок с нулями, ghost/injury через character `noteDefeat`.
CEF экрана результата не прогонялся.

### Architecture decision

Отдельный `ARC-CMB` не нужен. ADR-0020 остаётся: active fight только RAM.
Terminal outcome — снимок из combat; durable writes принадлежат character и
inventory. Composition (не `CombatService`) после RAM finish выполняет **одну**
Unit of Work, затем post-commit esrv. Combat не пишет `heroes` / `items`.
Catalog владеет authored наградой бота. `finished_fights` по-прежнему
best-effort: ошибка history не откатывает UoW.

Порядок: cancel delay → snapshot outcome → UoW (HP/EXP/money/loot/refill) →
history best-effort → enqueue loot+exit → hunt lock release → drop RAM.
Restart посреди боя по-прежнему без settlement (`combat-restart`). Pending
settlement table не создаётся.

### Outcome и награды (1v1 Gryzl 50310)

Solo win: игрок — top damager. EXP = overlay `base_exp` 15 (оверлевел L1 vs
L1 = 100%). `grantExperience` только если amount ≥ 1; иначе skip, не
вызывать port с `0`. Money: roll overlay `money_min`…`money_max` золотых
монет → `creditMoney` minor = `round(gold * 100)`. `money_gold` с охоты нет.
Item loot: FIGHT_LOOT ролл на мёртвого бота 2. Published entries **77 / 93 /
99** с overlay весами; `nothing_weight` = 3000 + сумма overlay-весов
неопубликованных artikul. Не подставлять 56–63 и т.п. Квест/данж лут нет.
Loss и last-human leave: `noteHp` + refill, без item loot и без EXP.
`noteHp` пишет fight HP как есть; HP `0` идёт в `noteDefeat` (ghost/injury).

Два охотника, один fight id: EXP пропорционально урону по боту, remainder
top damager; loot+money только top damager-человеку. Settlement один раз на
законченный бой, на каждого human в UoW. Ключ EXP:
`fight:{fightId}:{characterId}`. Повтор — тот же persisted result.

RNG — injected `RandomSource` (тесты без `Math.random` / `sleep`).

### Pocket refill

После win и loss (не practice): ячейки, из которых в бою тратили, добираются
из bag до `pocketCntMax` (`POCKET.md`). Снимок пояса на `startHunt`/`joinHunt`
уже есть в loadout; refill — inventory port, не combat. Неиспользованные
ячейки не трогать. Кончился стак — снова создать тот же `slot_num`.

### Wire

`fight|loot` ключи live `buildFightLootBlock`: `status:100`, numeric
`fight_id`, `experience`, `money` строка (`"0"` если нет), `honor:0`,
`revenge:0`, `loot` и `artikul_list` — `[]` если пусто, не `{}`. Один esrv
personal object: сначала `fight|loot`, потом `fight|exit`. Win/loss exit
`type:0` + `winner`. `leaveFight`: HTTP `{rs:true,sq}`; `fight|exit`
`{flee:true,status:100,type:2}`. Если в бою ещё живой союзник — leaver
получает только flee-exit, бой продолжается; полный loot/EXP — когда RAM
fight заканчивается. `chat|add` «Вами получено» / «Окончен бой» — [CHAT.md](CHAT.md) (SOC-01), не
этой capability. `fight|finish`
без самовольного `common|area_conf`.

`leaveFight` — dump-proven fproxy `rc`, не OA. Outdoor hunt уже `can_leave:1`.
Quest/dungeon deny «нельзя выйти из боя» не в срезе (нет quest fight).

### Content / schema

Catalog: на `bots` — `base_exp`, `money_min`, `money_max`, `loot_drop_cnt`,
`loot_bonus_chance`, `loot_bonus_min`, `loot_bonus_max`, `loot_nothing_weight`.
Таблица `catalog.bot_loot_entries` PK `(release_id, bot_id, artikul_id)`:
`drop_weight`, `count_min`, `count_max`; FK на `bots` и `artifacts` той же
release. Публикация без существующего artifact — ошибка candidate. Slice
version bump. Combat не читает fixtures.

### Out of scope (CMB-03 leftover)

Quest loot tables в combat (QST-ENG-02 clip — composition `needed`);
party split; dungeon bands; system chat; `Clock.schedule`;
OA FIGHT_JOIN/HELP; live `10_000_000+hero.id`.

## CMB-04 — reconnect, locks, ghost

Срез закрыт (raw-AMF). Пока `CombatPort.activeFightId` не null, `common|init2`
отдаёт `fight|conf` с тем же `fightId`/`fightAkey`/`userId`=`heroes.id`.
`state.fight_id` и `user|unitframe.fight_id` — numeric id боя, не HUD `0`.
Перед conf сбрасываются auth/bootstrap очереди аккаунта; следующий fproxy
`auth` снова паркует bootstrap. В паре resume без `oppwait`, сразу `oppnew`
и `attacknow` с остатком wall-clock `restTime`. Первый вход — `oppwait`→
`oppnew`. Таймер хода на F5 не паузится; hunt overlay остаётся busy.
Restart процесса по-прежнему без боя, награды и history (`combat-restart`).

Ghost/injury принадлежат character (`heroes.ghost`, `injury_time`,
`injury_artikul_id`). Combat эти колонки не пишет. Loss/HP 0 в
`HuntFightSettlement` вызывает `noteDefeat` в той же UoW. Ghost блокирует
CHR-02 regen. Roster `dead:4`. Injury id **875**, `injury_time` = unix now+600;
артефакт 875 не публиковать. OA `RESURRECT`: не в бою; HP
`max(2, floor(hpMax*0.05))`; снять ghost/injury; dest — текущая 503.
CEF F5/призрака не прогонялся.

### Architecture decision

Отдельный `ARC-CMB` не нужен. ADR-0020 не меняется: бой не пишется в
PostgreSQL. Reconnect — wire overlay на тот же RAM `Battle` (`resumeFight`
чистит очереди и `prepareResume`). History cleanup уже у
`FinishedFightCleanup` (72h, batch вне request path) — request-path
cleanup и OA `arena|finished_fights` не добавлялись. FightRules 203 на
layout/travel/USE/ATTACK уже есть; CMB-04 их не расширяет на store/npc.

### Out of scope (CMB-04 leftover)

OA FIGHT_JOIN/HELP; persist боя; `arena|finished_fights`; dungeon/BG
resurrect dest; artifact 875; `Clock.schedule`.

## CMB-05 — generic melee damage

Срез закрыт (raw-AMF). `BattleRules` держит knobs
`strPerDamagePoint=10`, `damageSpread=0.15` (`legacy behavior` из
`FIGHT_DAMAGE.md`), не dice под bot id 2. Урон =
`max(1, round(STR/10 × [0.85…1.15]))`. Hero STR — naked+gear через
`CharacterService.combatStrength` на ATTACK_BOT/join; bot STR —
`BotDefinition.strength`. Combat domain не импортирует character/inventory
repositories. Dodge/block/crit choke, charging overlay и VAMP — вне среза.
Glove ending (не AOE 16) крутит ту же STR-формулу; crit перчатки = верхняя
граница bounds.

Content: Грызль **2** STR 10 / 50310; Хисса **4** STR 15 / 50101; дух **32**
STR 35 / 50102; рыжий грызль **24** STR 45 / 50103. Луты 4/24/32 пустые
(`nothing_weight=1`) — DATA-03 bulk, не CMB-07. CEF урона не прогонялся.

### Architecture decision

Отдельный `ARC-*` не нужен. ADR-0017–0020 достаточны: active fight в RAM,
формула — именованный FightRules/policy knob, не persistent combat state.
Test-only `combatBotStrength` в composition extras форсирует bot STR для
e2e смерти; production path его не передаёт.

### Out of scope (CMB-05 leftover)

`rollMeleeOutcome` dodge/block/crit/DEF; kind-1 overlay; FIGHT_MAGIC;
weapon DPS aparte от STR.

## CMB-06 — bot spell book

Срез закрыт (raw-AMF). `pickBotSpell` — чистая функция в combat domain:
`fight_start` (burn if gated) → `prefer` → roulette + NOTHING. Книга
снапшотится на ATTACK_BOT (`HuntStartInput.botSpellBook`); combat не
читает catalog mid-fight. Пустая книга не зовёт `random.unit()` — Gryzl
остаётся melee-only. Kind-1 урон =
`max(1, round(STR/10 × (1+pcSTR/100) × [0.85…1.15]))`. Kind-2 heal и
AOE `targetCount>=2` есть в движке; в slice нет heal-бота (огр 99 / area
542 — WLD). Charging/self-buff, DoT ticks, MAGSTR/MAGRES, virus, summon —
вне среза. Полный `bot_spell_book.json` — DATA-03.

Content: Грызль **2** пустая книга / 50310; Хисса **4** spell **396**
`magic_direct` / 50101; дух **32** **422** `magic_darkball` / 50102;
рыжий грызль **24** **394** `magic_direct` / 50103. Execution blob на
карточке книги (нет type_id 72 dump). Catalog tables
`catalog.bot_spell_books` / `bot_spell_book_spells`. Schema
`playable-slice/v23`. CEF плевка Хиссы не прогонялся.

### Architecture decision

Отдельный `ARC-*` не нужен. AI choice не process/scheduler. ADR-0017–0020
достаточны.

### Out of scope (CMB-06 leftover)

DoT ticks (kind 4); charging overlay 397/428/395; MAGSTR/MAGRES;
virus 631; summon; full `bot_spell_book.json`; heal+AOE dump bot 99.

## CMB-07 — weighted loot table

Срез закрыт (raw-AMF). `rollBotLoot(BotReward, RandomSource)` — generic
Dwar-lite таблица: guaranteed `drop_weight=0`, затем `loot_drop_cnt` picks
(+ bonus `2^(max-n)`), пул `drop_weight>0` + NOTHING. Шанс pick ∝ вес /
сумма. Пустая таблица (Хисса/дух/рыжий) не выдумывает предметы. Quest
`kind:loot` и dungeon bands — не эта capability. Полный корпус —
DATA-03.

Gryzl **2**: NOTHING 3460 доминирует 77/93/99; unit past NOTHING даёт
**77**. CEF нефорсируемого RNG не прогонялся.

### Architecture decision

Отдельный `ARC-*` не нужен. Ролл не читает catalog. Policy-документы
квеста/данжа не создавать заранее.

### Out of scope (CMB-07 leftover)

Quest loot tables в combat (drop-cap — QST-ENG-02 composition);
dungeon personal/chance; party lottery; honor; полный
`bot_loot_entries` corpus.

## CMB-08 — duels and team shuffle

Срез закрыт (raw-AMF). `FightDuel` на том же `Battle`: hunt human↔bot и
friendly human↔human. Melee не ветвится hunt/PvP: удар идёт в текущего
соперника пары. OA `user|friendly_duel_propose` / `accept`; esrv
`user|friendly_duel_request` и `fight|conf` challenger-у. Invites
process-local, TTL 60s, fail-fast `203`. Practice settlement возвращает
HP/MP/pocket, без лута/EXP/травмы; `fight|conf.is_pvp=1`, `type:"6"`.
После 3↔3 melee hits в hunt с waiter: бот уходит waiter-у, актор
`oppwait`, HP/loadout без сброса. No-rotate — reset hits. bot↔bot и
cross-swap двух 3↔3 пар — leftover (в playable slice один бот на точку).
OA `FIGHT_JOIN` / `FIGHT_HELP` — hunt team 1, same-area (SOC-03). CEF не прогонялся.

### Architecture decision

ADR-0017–0020 достаточны. Invites как active fight: RAM, restart →
«вызов устарел». History type 6 — leftover.

### Out of scope (CMB-08 leftover)

Cross-swap двух живых 3↔3 дуэлей; bot↔bot; charging/DoT на shuffle hits;
practice finished_fights type 6; hunt join team 2. Real PvP assault —
BG-01, контракт [BATTLEGROUND.md](BATTLEGROUND.md). HERO-01 читает PvP
snapshot (ниже), не hunt loot.

## HERO-01 — PvP honor snapshot

Combat не считает героизм и не пишет `heroes.honor`. На terminal PvP
(`purpose:"pvp"`) snapshot отдаёт 1v1 humans: `level`, `maxHp`,
applied урон по вражескому человеку (`damageToHumans`: хилы раздувают
сумму; кредит как jgr-emu `applied`, не `damageToBot`), `winnerTeam`.
Все human-hits (melee + glove ending) идут через
`applyDamageToMeleeTarget`. Не ровно 2 humans — throw в composition.
Hunt/quest/friendly не грантят героизм; `fight|loot.honor` остаётся 0.
HTML `fight|info.users[].honor` — leftover INFO. Product-status —
[CAPABILITIES.md](../CAPABILITIES.md).

## CMB-09 — quest-fight mode hook

Срез закрыт (unit). `HuntStartInput.purpose` обязателен: `"hunt"` | `"quest"`.
Карта ATTACK_BOT всегда `"hunt"`. Terminal notice —
`{ accountId, fightId, winnerTeam, outcome, purpose }`; тот же
`FightTerminalObserver`, что `HuntLockRelease`. Quest-модуль подписывается
fan-out в composition, combat quests не импортирует. `purpose: "quest"`
запрещает `joinHunt`. CMB-03 UoW (HP/EXP/loot) не меняется; QST-ENG-02
режет hunt grant в composition через quests `needed`, не внутри combat.
Roster allies/enemies, `flags:"8"`, chat_*, bot↔bot, deny leave — leftover
после QST-ENG-02. Dialog `START_FIGHT` — QST-ENG-01; AREA leftover
`START_FIGHT` — QST-ENG-02 (`QuestDesk`, не combat).

### Architecture decision

ADR-0017–0020 достаточны. `ARC-*` нет. Active fight RAM; restart без
`on_win`/`on_lose`.

### Out of scope (CMB-09 leftover)

Quest roster и wire `flags:"8"`; `on_win`/`on_lose` scripts сверх terminal
notice; bot↔bot pairing; quest deny leave; curated Акрилон.

## GEAR-01 — equipped gear spells

Срез: representative **20546** «Изначальная мифическая перчатка тирана VI»
(kind 44, слот 32). Catalog владеет authored `extra.spell` (`groupId` 936,
kind 3, `duration` 320, `pcSTR` 10, без `triggers`). Inventory держит
instance paperdoll и read-only `equippedGearSpells` / `list`; блоб на
`items` не копируется, fight effect в inventory нет. Combat — RAM registry
(`remainTurns`, baked STR, `expiresAtMs`); `inventory.items` не пишет.
Composition `HuntCombatLoadout.snapshot` кладёт `CombatLoadout.gearSpells[]`
`{ artikulId, title, picture, spell }` на `startHunt` / `joinHunt` /
friendly-duel start (как CMB-02 pocket/glove и CMB-06 bot book). Combat
domain не импортирует inventory/catalog repositories и не читает их
mid-fight.

Snapshot — на **старт боя**, не на PUT_ON и не лениво на удар. PUT_ON вне
боя только меняет location. В бою layout — FightRules `203` «нельзя во
время боя». Пустые `extra.spells[]` у 20546 валидны: `glove: null` для
комбо, gear-spell всё равно в snapshot. Непустые сокеты — прежний CMB-02
fail-fast.

Attach — тихий RAM в `Battle` create. Первый fproxy bootstrap и reconnect
в том же процессе: после `persSpells` → `persEff` nested `"1"` (id, kind 3,
persId, sourceId=heroId, artikulId 20546, title, img=picture, dmgType,
remainTime, groupId 936) → сразу `effUse` с теми же полями + `flags:0` +
kind-3 `skills` (`pcSTR` печётся в flat STR). Прока нет. Expire:
`onActorEndingTurn` кастера (self-buff считает ending action героя),
`remainTurns` 8 = 320/40; при `≤0` или wall-clock `expiresAtMs` в том же
melee poll после `cast`, до `{rs,sq}`: `{ et:"effPurge", effectId }`.
j-emu melee MULTI остаётся CMB-01 `attackwait`+`cast`; `effPurge`
дописывается после `cast` в том же poll. `timeAdvance` нет. `persEff` при
expire не пересылается. Standing kind-3 STR участвует в CMB-05 melee,
пока эффект жив.

Каталожный парсер сохраняет authored `duration` / `forceSelfTargeting` /
`realStartTime`. Paperdoll `extra.spell` с `triggers` / `onlyPvP` / kind≠3
в опубликованном срезе — fail-fast публикации. Нет `Clock.schedule`. Нет
generic effect engine сверх kind-3 без triggers.

Equipped 20546 в PostgreSQL переживает reconnect и process restart.
RAM-эффект и бой — нет (ADR-0020). Reconnect до restart: bootstrap
`persEff`+`effUse` с оставшимся `remainTime`.

Dump-блоб 20546 без `dmgType`: на wire сейчас `0` (raw-AMF e2e). Live
`attachFightEffect` для отсутствующего поля ставит `1`. Kind-3 STR-бафф
школу не читает; выравнивание — leftover, не этот срез.

CEF не прогонялся (Wave 12, [CEF_MANUAL.md](../migration/CEF_MANUAL.md)).

## Границы модулей

Combat получает immutable combat-ready snapshots через public ports; catalog
и inventory не импортируются как repositories внутрь fight engine. Settlement
вызывает owning application ports из composition после terminal outcome.

Не создавать generic «будущий» battle abstraction ценой изменения работающего
legacy flow. Механики переносятся capability за capability.

## Acceptance будущей полной combat wave

- полный hunt fight проходит в клиенте без timeout/hang;
- pocket/glove/native counters не списываются дважды;
- win/loss/leave дают правильные terminal packets и durable state;
- restart прекращает active fight без partial settlement;
- reconnect до restart восстанавливает wire state;
- DB не получает writes на каждый strike/poll.
