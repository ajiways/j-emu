# Combat

## Статус

Есть hunt melee loop (raw-AMF L/C/R, delay grant/bot-counter, kill, waiter
re-pair), map `joinHunt` team 1, CMB-02 pocket/glove/rage casts, CMB-03 terminal
settlement, CMB-04 reconnect/ghost/RESURRECT, CMB-05 STR-урон, CMB-06
bot spell book, CMB-07 loot, CMB-08 friendly duel + hunt 3↔3 waiter
handoff и GEAR-01 RAM kind-3 с надетой 20546 (raw-AMF). CMB-11: OA
`FIGHT_JOIN` `{team:1|2}` / `FIGHT_HELP` входят в тот же RAM `fightId`,
copy gate, team-2 без hunt EXP; CMB-12: две параллельные hunt-дуэли на
50310 (opener↔bot и team-1↔team-2). CEF 2026-09-17: hunt 3↔3 / F5 /
overkill / орб 99 / сайдбар / loot tooltip. Product status combat остаётся
частично (bot AOE, MAGRES, HUD EXP, friendly duel).
CMB-09 отдаёт
quest `on_win`/`on_lose` через `FightTerminalObserver` (unit). AREA
`START_FIGHT` (quest + ambush) и hunt loot-cap — composition (`QuestDesk` /
`HuntFightSettlement`), не combat domain. Roster/flags квестового боя
landed raw-AMF (`CMB-10`); deny leave — `QST-ENG-04`; CEF leftover.

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
   `persSelf_body` / `persSelf_sk` — текущие `heroes.body` / `heroes.sk`, не
   статичный policy stub.
2. `fight|conf.proxy` — live URL `https://s1.jugger.ru/fproxy//;`. CEF шлёт
   poll и `auth` на HTTPS `/fproxy//;`. Процесс также слушает TCP `:33120`
   (policy + length-prefixed AMF) как запасной путь. HTTP `auth` паркует
   bootstrap в очередь; следующий poll отдаёт `{rs}` + `{ev: fightState…oppnew}`
   - `{ev: attacknow}`. Auth/strike будят account-scoped waiters.
3. Melee poll: leading `attackwait` + `cast` → `{rs,sq}`; bot `cast` ~1400 ms
   позже; standalone `attacknow` ~2500 ms только кастеру.
4. Pocket/glove/rage: HTTP `castSpell` пустой; poll `{rs,sq}` **до** FX для
   `srcType` 2/3 и native 6/7. Melee L/C/R остаётся strike-then-rs.
5. Terminal: fproxy `fightFinish`; после того как клиент забрал этот кадр —
   esrv `fight|loot` затем `fight|exit` в одном `2:` object, плюс system chat
   «Окончен бой» / лут (не на killing blow). HUD в том же object.
   Если poll забрал `finished` раньше, чем `persistFinished` вернул loot,
   held loot/exit выпускаются сразу после persist (CEF 2026-09-16: окно
   «завершение боя» ~60 с без `fight|exit`).

Inventory layout lock (`PUT_ON`/`PUT_OFF`/`DROP`/`SELL` → `203` в бою) —
`requireNoActiveFight` в [INVENTORY.md](INVENTORY.md), не live. Live
[FIGHT_LOCK.md](../../../jgr-emu/docs/FIGHT_LOCK.md) эти коды не режет.
Трата из кармана — fproxy. World USE, COME_IN/`common|exit` и ATTACK — live
`fightBusy`; WLD-01 применяет то же `requireNoActiveFight` `203`. Карта ATTACK_BOT:
ключ — spawn id; занятая живая точка — `joinHunt` team 1. OA `FIGHT_JOIN` /
`FIGHT_HELP` — hunt team 1\|2 и PvP Раскопа (CMB-16), same-area **и**
same-copy, dump 204 (CMB-11).
Live `10_000_000 + heroes.id` в `userId` не копировать
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

Player melee и ending glove бьют `FightDuel.otherId`, а не тип боя.
Цель — живой human в паре или hunt bot; иначе fail-fast. После удара
сначала 3↔3 shuffle; bot-counter ставится только если противник всё ещё
бот, иначе grant этому human.
Решения bootstrap, join, settlement и history читают `FightRules`.
Тип боя живёт только как `setup.meta.kind`. Hybrid (люди и боты в обеих
командах) ещё не playable slice; finish — когда на стороне цели не
осталось живых.

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

`persList`/`persChangeInfo` `dealtDamage` — applied HP loss (human:
`damageToBot+damageToHumans`, bot — свои удары/kind-1). Тот же счётчик в
`fight|info.users[].dmg`. Не зашивать `0`.

Off-turn / waiter / already-ended: пустой HTTP + poll `{rs:true}` без HP.
Не `restriction:18` и не fproxy `error`.

Пропуск хода: после `attacknow` wall-clock `turnTimeoutSeconds` шлёт кастеру
отдельный `{et:attacktimeout}`, сдаёт ход (GEAR-01 remaining) и **считается
ходом пары** — `FightDuel.addHit` как melee, затем тот же 3↔3 shuffle.
Сразу bot `cast` в hunt (если пара ещё bot) или grant фою в PvP, затем
standalone `attacknow`. Strike / ending cancel'ит таймер. CEF 2026-09-17.

## CMB-02 — pocket / glove / rage

Срез закрыт (raw-AMF). `startHunt`/`joinHunt` принимают immutable loadout
(pocket + надетая перчатка или пусто). Снимок собирает `jugger-wire`
`HuntCombatLoadout` из inventory/catalog ports; domain combat не импортирует
их repositories. Combat RAM держит count/cp/rage. F5/`auth` bootstrap и
агро `persSpells` (MagicsModel replace) берут **оставшийся** pocket count
из RAM (`wireLoadout`); строки с 0 опускаются, как jgr `cnt<=0`. Снимок
старта остаётся для `pocketCells.startCount`. Fproxy HTTPS: decode →
combat cast → `takePocketConsume` → inventory `consumePocket` только после
успеха, в `UnitOfWork`. TCP fproxy не персистит карман: pending consume —
ошибка (production путь — HTTPS).

HTTP `castSpell` на успех пустой. Карман 93/99, ярость 6, агро 7, keep-turn
перчатка: `{rs,sq}` первым в том же poll, потом FX. Ending glove: rs затем
strike с leading `attackwait`. Off-turn ending: `{rs:true}` + абсолютный
`persCP`. 93 CD deny: HTTP `{rs:false}` без `restriction`. 99: `cast ev:[]`,
без `persSpells` в FX. 6: rs затем fury. 7: rs затем полный `persSpells`
(MagicsModel replace) с абсолютным `count` у srcId 7, включая карман и
перчатку. Partial packet только с «Разозлить» стирает бар.
Melee L/C/R остаётся strike-then-rs. Ярость 6: standing kind-3 `artikul` 212 /
group 844 / `rageeffect_2702.png`, `remainTime` 0, `skills.pcSTR` с fill
(50%→+18, 100%→+50). Consuming L/C/R шлёт `effPurge`. Повтор и пустая шкала —
только `fury` `ev:[]`, без второй иконки.

Content: dump-proven `spell` у **93** (хил, CD 20) и **99** (орб `ev:[]`);
**9095** сокеты **9098/9100/9099**. World-карточка и `user|magic` —
[INVENTORY.md](INVENTORY.md); бой читает instance `data_json` (пул 23 и 9095
после grant) в `HuntCombatLoadout`. Catalog `extra.hits` у 9095 остаётся
для unrolled backfill. MAGRES/MAGSTR school roll при
grant не катится. 77 без fight blob. Pub1 AMF у 93/99
часто опускает `extra.spell.flags` (ноль). Live fproxy pocket `persSpells` /
`effUse` всё равно шлёт `flags:"262144"` — `POCKET_SPELL_WIRE_FLAGS`, не
catalog fallback. Нет `srcId:5` в
fproxy, нет 77 в бою, нет generic effect engine. Glove ending AOE
(`targetCount>=2` или `targetRestr.randTarget`, «Волна света» 9099): живые
враги hunt-боя, primary = текущая пара, остальное Fisher-Yates через
injected RNG, урон `max(1, round(full/2))`. Caster и остальные authed:
`persChangeInfo` по hit id **отдельным** `ev` map **после** ST `cast`
(`magic_aoe_*` стопит CombatQueue). Один map с absolute HP и `hpChange` на
том же id даёт 5 vs 3 / 0 на живом. Ally, чей фо —
secondary, получает тот же кадр: roster patch + `animData` и `targetId`
своего фо. Kill secondary — `attackwait` + `react=KILL` + `oppwait`/swap
на той дуэли. Bot kind-1 AOE — leftover. Орб 99 drink вешает RAM standing
kind-3 (`charging` ходов, `groupId` 842, без bake STR — melee бонус остаётся
`takeOrbPcStr`); consuming L/C/R melee шлёт `effPurge`; glove/kind-1 орб не
тратит. Повторный drink той же group при `groupdeny` отклоняется (см. «Стаки эффектов»).
CEF 2026-09-17: орб 99 standing + `effPurge` на физ L/C/R. Glove AOE
(`targetCount>=2`, «Волна света»): CEF 2026-09-17 урон по двум мобам и
same-map HP. Bot kind-1 AOE бьёт тех же выбранных врагов (ADR-0021).
Заклинание только для своих (`opp:false` и `oppTeam:false`, «Дар неистовства»,
«Прикрытие»): glove-cast несёт `targetId` клика, бафф ложится на эту цель и, при `targetCount` N,
ещё на N−1 случайных других, кто тоже может его нести (`spell-target.ts`). Правила носителя из
каталога: своя сторона, жив (`dead:false`), не сам кастер (`self:false`), игрок или моб
(`noBot`), и из той же группы (`inParty`: `CombatLoadout.partyId` героя, его кладёт
`HuntCombatLoadout` из `PartyService.partyIdOf` при старте/входе в бой; группа в бою не
меняется). Клиент проверяет то же до отправки и сам показывает тосты (`jgr-emu/docs/FIGHT_TOASTS.md`),
поэтому чужая/мёртвая цель, кастер при `self:false`, моб при `noBot:true`, чужая группа и клик
не по союзнику — тихий `{rs:false}`: ничего не накладывается и не перенаправляется. Живого
дампа каста по союзнику нет — форма запроса взята из контракта `castSpell`, смысл `targetCount`
(клик + N−1 случайных) — решение владельца.
Kind 11 HTTP
`{rs:false, restriction:18}` — только если опубликованный spell kind 11
(в текущем slice нет). CEF счётчиков пояса/перчатки/ярости не прогонялся.

## CMB-03 — terminal settlement

Срез закрыт (raw-AMF). Composition `HuntFightSettlement` после RAM finish:
одна UoW (`noteHp`, `grantExperience` если ≥ 1, `creditMoney`, `grantToBag`,
`refillPocketAfterFight`), затем history best-effort, затем esrv
`fight|loot` затем `fight|exit`. Combat не пишет `heroes`/`items`. Catalog
бот 2: `baseExp` 15, money 0.2–0.44, `lootNothingWeight` 3000,
entries overlay 27 штук (включая **77 / 93 / 99**). `leaveFight` HTTP
`{rs:true}`; last human — flee `type:2` без лута; союзник жив — только
flee-exit, бой продолжается. Погибший игрок при живой команде остаётся в бою: клиент получает
`opponent-wait` (кнопки «выйти» / «остаться»; выйти можно только если `canLeave`), итог и
loot приходят ему вместе со всеми, когда бой закончится (старый сервер, `flee`). Loss: HP 0, loot-блок с нулями, ghost/injury через character `noteDefeat`.
CEF 2026-09-17: экран результата hunt открывается; CEF 2026-09-29: EXP и деньги
обновляют HUD вместе с `fight|exit` (persist — одна UoW на RAM finish; wire — § Wire).

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
Item loot: FIGHT_LOOT ролл на мёртвого бота 2. Overlay entries **27**
(включая **77 / 93 / 99**) с authored весами; `nothing_weight` = 3000.
Квест/данж лут нет.
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
`revenge:0`, `loot` и `artikul_list` — `[]` если пусто, не `{}`. Отдельного
kill-кадра `user|unitframe` нет: EXP и деньги приходят только вместе с
`fight|loot` + `fight|exit` + `user|unitframe`/`user|conf`/bag/state в одном
personal esrv-кадре (live `2players_social_2026-08-11`: `fight|exit` →
`fight|loot` → `state.money` + `user|unitframe.exp` одним кадром).
Win/loss exit `type:0` + `winner`. Кадр loot+exit+HUD (и chat «Окончен
бой») выдаётся через `combat.resultRevealDelayMs` после того, как fproxy poll
забрал `fightFinish` (live дамп: exit → loot/HUD ~1.5–1.8 с после добивания;
клиент момент «выйти» не сообщает, `fight|finish` OA приходит позже). Persist
при этом остаётся на RAM finish. Окно нового уровня (`common|window`,
[CHARACTER.md](CHARACTER.md)) уходит вместе с этим кадром (`publishEnded`). Flee-exit `last-leave` не откладывается. `leaveFight`: HTTP `{rs:true,sq}`; `fight|exit`
`{flee:true,status:100,type:2}` и тот же HUD (без loot). Если в бою ещё живой союзник — leaver
получает только flee-exit, бой продолжается; полный loot/EXP — когда RAM
fight заканчивается. `chat|add` «Вами получено» / «Окончен бой» — [CHAT.md](CHAT.md) (SOC-01), не
этой capability. OA `fight|finish` — flat: `{status:100}`, `fight|info`
(RAM last snapshot: `fight.id` строка = `fight|loot.fight_id`, `started`
`DD.MM HH:MM`, `users` по participant id, `status:100`, обязательные
`share` + `macroses` SHARE — без них Flash `SocialComponent` падает до
`window.Show`), `fight|conf.expire=0`,
unitframe, bag, view, magic, skills, `state`; без самовольного `common|area_conf`.
Лут на `fight|info` не класть — AS3 ShowData уже отработал с esrv `fight|loot`.
Restart стирает RAM info (ADR-0020): finish без карточки.

Outdoor hunt `can_leave:1`. Quest/dungeon `leaveFight` deny
`{rs:false, err:"нельзя выйти из боя", sq}` — QST-ENG-04.

### Content / schema

Catalog: на `bots` — `base_exp`, `money_min`, `money_max`, `loot_drop_cnt`,
`loot_bonus_chance`, `loot_bonus_min`, `loot_bonus_max`, `loot_nothing_weight`.
Таблица `catalog.bot_loot_entries` PK `(release_id, bot_id, artikul_id)`:
`drop_weight`, `count_min`, `count_max`; FK на `bots` и `artifacts` той же
release. Публикация без существующего artifact — ошибка candidate. Slice
version bump. Combat не читает fixtures.

### Out of scope (CMB-03 leftover)

Quest loot tables в combat (QST-ENG-02 clip — composition `needed`);
party split; dungeon bands leftover (personal/coins — DNG-03 landed); system chat; `Clock.schedule`;
OA FIGHT_JOIN/HELP (CMB-11); live `10_000_000+hero.id`.

## CMB-04 — reconnect, locks, ghost

Срез закрыт (raw-AMF). Пока `CombatPort.activeFightId` не null, `common|init2`
отдаёт `fight|conf` с тем же `fightId`/`fightAkey`/`userId`=`heroes.id`.
`state.fight_id` и `user|unitframe.fight_id` — numeric id боя, не HUD `0`.
Перед conf сбрасываются auth/bootstrap очереди аккаунта; следующий fproxy
`auth` снова паркует bootstrap. В паре resume без `oppwait`, сразу `oppnew`
и `attacknow` с остатком wall-clock `restTime`. Первый вход — `oppwait`→
`oppnew`. Таймер хода на F5 не паузится; hunt overlay остаётся busy.
`persSpells` на resume — live pocket count, не count входа в бой.
CEF 2026-09-17: F5 mid-hunt, `persEff.img`, pocket count.
Restart процесса по-прежнему без боя, награды и history (`combat-restart`).

Ghost/injury принадлежат character (`heroes.ghost`, `injury_time`,
`injury_artikul_id`). Combat эти колонки не пишет. Loss/HP 0 в
`HuntFightSettlement` вызывает `noteDefeat` в той же UoW. Ghost блокирует
CHR-02 regen. Roster `dead:4`. Injury id **875**, `injury_time` = unix now+600;
артефакт 875 не публиковать. OA `RESURRECT`: не в бою; HP
`max(2, floor(hpMax*0.05))`; снять ghost/injury. Outdoor dest — временный
хардкод храма **503** (CEF 2026-09-16: смерть в 501 → воскрес в 503).
Канон dest — [WORLD.md](WORLD.md) leftover (`kind_info.resurrect_teleport`,
данж start area, BG spawn). Ghost `resurrect_zones` outdoor =
`{503:{title}}` с каталожным title, пока `state.area_id` ещё смерть.
Копия данжа — start area той же copy. CEF 2026-09-17: F5 mid-hunt тот же
`fightId`/`akey`, без `oppwait`. F5 `persEff.img` на standing hero/bot
(bootstrap + `persEff` inspect) и live pocket count — CEF 2026-09-17.

### Architecture decision

Отдельный `ARC-CMB` не нужен. ADR-0020 не меняется: бой не пишется в
PostgreSQL. Reconnect — wire overlay на тот же RAM `Battle` (`resumeFight`
чистит очереди и `prepareResume`). History cleanup уже у
`FinishedFightCleanup` (72h, batch вне request path) — request-path
cleanup и OA `arena|finished_fights` не добавлялись. `requireNoActiveFight` 203 на
layout/travel/USE/ATTACK уже есть; CMB-04 их не расширяет на store/npc.

### Out of scope (CMB-04 leftover)

OA FIGHT_JOIN/HELP (CMB-11); persist боя; `arena|finished_fights`;
artifact 875; `Clock.schedule`. Outdoor dest 503 —
временный stub ([WORLD.md](WORLD.md)). CEF очередь 2026-09-16 —
[CEF_MANUAL.md](../migration/CEF_MANUAL.md).

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

Content: Грызль **2** STR 8 / 50310; Хисса **4** STR 15 / 50101; дух **32**
STR 35 / 50102; рыжий грызль **24** STR 45 / 50103. Overlay-луты 4/24/32
не пустые. CEF 2026-09-17: STR-урон на полоске Грызль 50310; leftover
overkill clamp. Wire `hpChange` — −min(raw, currentHP): добивание 3 HP
ударом 7 даёт `-3`, не `-7`. То же на kind-1/glove/DoT.

### Architecture decision

Отдельный `ARC-*` не нужен. ADR-0017–0020 достаточны: active fight в RAM,
формула — именованный FightRules/policy knob, не persistent combat state.
Test-only `combatBotStrength` в composition extras форсирует bot STR для
e2e смерти; production path его не передаёт.

### Out of scope (CMB-05 leftover)

dodge/block/crit — CMB-14. kind-1 overlay — CMB-15. Weapon DPS aparte от STR.
Ущелье 501 три dump-hunt — ещё CEF.

## CMB-06 — bot spell book

Срез закрыт (raw-AMF). `pickBotSpell` — чистая функция в combat domain:
`fight_start` (burn if gated) → `prefer` → roulette + NOTHING. Книга
снапшотится на ATTACK_BOT (`HuntStartInput.botSpellBook`); combat не
читает catalog mid-fight. Пустая книга не зовёт `random.unit()` — Gryzl
остаётся melee-only. Kind-1 урон =
`max(1, round(STR/10 × (1+pcSTR/100) × [0.85…1.15]))`. Kind-2 heal есть;
Glove kind-1 AOE landed (CMB-02). Bot kind-1 с `targetCount>=2` бьёт до
`targetCount` живых врагов, урон каждому — отдельный бросок без деления (ADR-0021). Огр **99** книга в каталоге DATA-03
(kind-2 heal на 40% HP). Kind-1+DoT (396): финишер HP, затем `effUse`
kind-4 на охотнике (catalog title/img, group 845, overlay `durationTurns`
3). Charging/self-buff, MAGSTR/MAGRES, virus, summon — вне боя: карточки
живут в каталоге DATA-03, `pickBotSpell` не выбирает kind 3/10 и gate
`foe_has_dispel_groups`. Полный `bot_spell_book.json` импортирован.

Content: Грызл **2** пустая книга / 50310; Хисса **4** spells **396**+**397**
(`396` `magic_direct` / 50101); дух **32** **422**+**428**;
рыжий грызль **24** **394**+**395**. Execution blob с DATA-02 artifact
`extra.spell`. Catalog tables
`catalog.bot_spell_books` / `bot_spell_book_spells`.

### Architecture decision

Отдельный `ARC-*` не нужен. AI choice не process/scheduler. ADR-0017–0020
достаточны.

### Out of scope (CMB-06 leftover)

Charging overlay 397/428/395 как эффект, не как отсутствие карточки;
MAGSTR/MAGRES; virus 631; summon; gate `foe_has_dispel_groups`. Kind-4
attach+`effUse` для 396 landed (unit/raw-AMF); sibling tick `hpChange` на
melee охотника landed (unit); kind-1 charging 397 `effUse` на мобе landed
(unit). CEF 2026-09-17: иконка 396, тики HP, ярость 212 `effPurge`,
self-buff 397 на мобе.

## CMB-07 — weighted loot table

Срез закрыт (raw-AMF). `rollBotLoot(BotReward, RandomSource)` — generic
Dwar-lite таблица: guaranteed `drop_weight=0`, затем `loot_drop_cnt` picks
(+ bonus `2^(max-n)`), пул `drop_weight>0` + NOTHING. Шанс pick ∝ вес /
сумма. Overlay-таблицы Хиссы/духа/рыжего не пустые. Quest
`kind:loot` — не эта capability. Dungeon personal/coins — DNG-03
landed (composition). `loot.bands` leftover.

Gryzl **2**: overlay NOTHING 3000 / 27 entries (не handwritten 3460/77/93/99).
`rollMoneyGold` берёт закрытый интервал между `money_min` и `money_max`
независимо от порядка (overlay 117: 9 и 0). CEF нефорсируемого RNG не прогонялся.

### Architecture decision

Отдельный `ARC-*` не нужен. Ролл не читает catalog. Policy-документы
квеста/данжа не создавать заранее.

### Out of scope (CMB-07 leftover)

Quest loot tables в combat (drop-cap — QST-ENG-02 composition);
dungeon `loot.bands` leftover; personal/coins — DNG-03 landed composition, не
combat import; party lottery; honor.

## CMB-08 — duels and team shuffle

Срез закрыт (raw-AMF). `FightDuel` на том же `Battle`: hunt human↔bot и
friendly human↔human. Melee не ветвится hunt/PvP: удар идёт в текущего
соперника пары. OA `user|friendly_duel_propose` / `accept` / `decline`; приглашение уходит
целевому игроку esrv `common|window` (title «Приглашение на дуэль», image
`images/duel.png`, кнопки с embedded OA `user|friendly_duel_accept|decline`
`{nick}` и `ban_keys`, как trade/friend/group; live 2players dump), challenger-у
после accept — `fight|conf`. Старый `user|friendly_duel_request` — не live wire,
удалён. «Игнорировать» — только клиент (`ServerWindow.buttonClick`): OA не
шлётся, клиент запоминает `ban_key` до перезапуска, и окна с тем же ключом
больше не показываются (`showBlocking`). Ключ у нас `md5(friendly-duel:
challenger:target)`, то есть бан на пару. Сервер об игноре не знает: вызов
висит до TTL 60 с и снимается им; повторный propose от того же игрока для
игнорирующего невидим. Live-схема ключа неизвестна (в дампе один ключ на две
одинаковые пары). Invites
process-local, TTL 60s, fail-fast `203`. Practice settlement возвращает
HP/MP/pocket, без лута/EXP/травмы; `fight|conf.is_pvp=1`, `type:"6"`.
После 3↔3 melee hits каждый удар (игрок и бот) и пропуск хода
(`attacktimeout`) проверяет, можно ли сменить противника: живой waiter
на своей команде → бот уходит waiter-у, актор `oppwait`; waiting enemy
(клон «Разозлить») → `oppnew` клона; вторая human↔bot дуэль тоже 3↔3 →
cross-swap. 3↔3 не сбрасывается, пока менять некого. HP/loadout без
сброса. bot↔bot leftover.
OA `FIGHT_JOIN` / `FIGHT_HELP` landed raw-AMF (CMB-11). CEF 2026-09-17:
hunt 3↔3 shuffle и без второго удара бота после cross-swap. Friendly
duel — ещё CEF.

### Architecture decision

ADR-0017–0020 достаточны. Invites как active fight: RAM, restart →
«вызов устарел». History type 6 — leftover.

### Out of scope (CMB-08 leftover)

bot↔bot; charging/DoT на shuffle hits; practice finished_fights type 6.
Hunt join team 2 landed in CMB-11. Real PvP assault —
BG-01, контракт [BATTLEGROUND.md](BATTLEGROUND.md). HERO-01 читает PvP
snapshot (ниже), не hunt loot.

## CMB-11 — hunt join team 2 / intervene

Срез закрыт (raw-AMF). Product-status не поднимать: CEF не прогонялся.
Очередь: [ROADMAP.md](../migration/ROADMAP.md) CMB-11 (`done`).

OA `FIGHT_JOIN` `{fight, team:1|2}` и `FIGHT_HELP` `{nick}` входят в **тот
же** RAM `fightId`, что и opener. Успех — тот же flat, что `ATTACK_BOT`
(`common|action` 100, `fight|conf`, `common|hunt`, `user|unitframe`,
`state`). Остальным authed в бою — roster/pers. Карта `ATTACK_BOT` на
занятый spawn (outdoor и dungeon copy) по-прежнему `joinHunt` team **1**.
Party chat ACTION «ПОМОЧЬ» остаётся team **1** (opener охоты).
`purpose:"quest"` и friendly `kind` — `HuntJoinDenied`. PvP Раскопа —
CMB-16.

### Copy и area

`Battle` держит `areaId` и `instanceCopyId` (`null` = мир) со `startHunt`.
`joinHunt` сравнивает оба с joiner. Чужой area **или** чужая копия →
`HuntJoinDenied` «бой в другой локации» → dump 204 «Нельзя вмешаться в бой,
находящийся в другой локации!» (jgr `joinFight` тот же текст на copy
mismatch). Combat не импортирует instance/party tables: composition
передаёт `Hero.instanceCopyId`. `DungeonHuntMapAttack.startHunt` проставляет
copy; outdoor `HuntMapAttack` — `null`.

### Team и pairing

`HuntJoinInput.team` = `1|2`. `huntJoiner` берёт team из join, не хардкод
`1`. `FightJoinCommand` не подменяет team 2 статусом «неактивный бой».
HELP ставит joiner на team цели из того же `Battle` (не хардкод `1`).

jgr — N×N `tryPairQueues`. CMB-12: hunt `Battle.duels[]`. После join
непарные living waiters team 1 и team 2 сразу получают `FightDuel`
(T1 opens). Opener остаётся на боте. Delay jobs — token
`${fightId}:${minId}:${maxId}`; strike cancel только свой duel.

CMB-11 2-hero JOIN team 2 без team-1 waiter по-прежнему ждёт бота:

- team **1** joiner: waiter CMB-08, может взять бота;
- team **2** joiner без свободного team-1: waiting, **не** в пуле бота;
- пока бот жив, этот team-2 ждёт; смерть бота при живом team-2 **не** finish —
  тот же `FightDuel` ретаргет живой team-1 ↔ team-2;
- finish — `enemySideCleared` по людям **и** ботам стороны.

### PvP как состав боя

Бой PvP, когда в каждой команде есть человек (`rosterIsPvp`; умершие и вышедшие
остаются в списке, поэтому ответ меняется только при входе). Это не тип боя:
охота, в которую вошёл человек за команду мобов, становится PvP. От предиката
зависят `fightState.pvp` в bootstrap и запрет каста спеллов с `onlyPvP` (pocket,
glove; denial — `FightCastDenied("pvp-only")`, wire `{rs:false}`, как cooldown).

Нападение на игрока — обычный `FIGHT_JOIN` в команду против человека.
`PlayerAttackPolicy` (порт combat, `requireAllowed`) вызывается, только если
join в `hunt-roster` бой делает его PvP. Composition ставит
`RadwayPlayerAttackPolicy`: на Радвее нападать на игроков нельзя нигде, join
отказывается `HuntJoinDenied` (dump 204). Текст отказа выдуман, дампа нет.
Фракции и локации — параметры `PlayerAttackAttempt`, пока не читаются.
Раскоп и дуэли PvP по типу старта, политику не спрашивают. Honor и settlement
PvP по-прежнему только 1×1 (`persistPvpHonor`): охота, ставшая PvP, считается
как охота.

### Участники и ветвление по составу

Участники боя — `HumanFighter` и `BotFighter` (общий интерфейс `Fighter`, один
путь потери HP `resolveHpLoss`). Бой не ветвится по типу: bootstrap, ход бота,
тики roster-дуэлей и итог зависят от того, есть ли в бою боты
(`Battle.hasBots`, `bots.length`), и от состава команд (`rosterIsPvp`).
`FightRules.hasEnemyBots` и `kind` остаются только правилами **старта**:
валидируют состав `FightSetup` и выбирают строку истории
(`historyRow`); рантайм их не читает.

### CMB-12 — parallel hunt duels

Срез закрыт (raw-AMF). Product-status не поднимать: CEF не прогонялся.
Очередь: [ROADMAP.md](../migration/ROADMAP.md) CMB-12 (`done`).

Три героя на **50310**: A opener vs Грызль; B occupied `ATTACK_BOT` team 1;
C `FIGHT_JOIN` `{team:2}` сразу vs B (`oppnew` human, `bot !== true`).
A после пары B↔C продолжает melee vs bot. Параллельные `FightDuel` не
делят ход, цель и delay token: удар/каст/bot-counter только
`otherId` своей пары. Общий `Battle` — roster HP, `persList`/`persChangeInfo`,
finish стороны, 3↔3 cross-swap. Список участников: fproxy `persEff`/`persInfo`
(клик и таймер 5 с), bootstrap `persEff`+`effUse` чужих людей, live fan-out
`effUse`/`effPurge` всем authed. Id эффектов общие на бой. Моб — standing
kind-3/4 (`effUse`, CEF 2026-09-17: ярость 212 и self-buff 397). Связь «чужой удар сбил мой ход» — leftover
таймера после swap, не общая очередь ходов. Смерть A vs bot при живых B↔C
не закрывает бой: dissolve A↔bot, bot unpaired.

2-hero team-2 wait (нет team-1 waiter) не режется. Wire IDs, 1v1 hunt,
JOIN copy isolation, quest-join deny — без изменения.

### Settlement

`FightHumanOutcome.team` уже есть. Hunt EXP и artikul-лут — только
opener-team при `winnerTeam === openerTeam` (jgr `rewardForHuman` при
`team === 1` и `wonByHero`). Team-2: HP/pocket/ghost как любой участник,
без hunt EXP. Party money split по-прежнему берёт всех party-членов в
этом бою (край: свой team-2 в той же группе). `winnerTeam === 2` — hunt
loss для team-1, не «победа intervenor-а» с лутом моба.

### Fail-fast / restart / CEF

Dump 204: другая локация/копия; цель не в бою; stale/missing fight.
Уже в бою → 203 «нельзя во время боя». Quest/duel join — текущие тексты
через `asHelpFightError` (не dump-таблица FIGHT_JOIN.md). Team 2 — валидный
вход, не «неактивный бой».

Restart процесса уничтожает RAM бой (ADR-0020): JOIN/HELP после restart —
stale 204, без resurrect. Reconnect до restart — тот же `fightId`/`akey`.

Production consumer. Product **частично** до CEF. Строка в
[CEF_MANUAL.md](../migration/CEF_MANUAL.md) добавлена.

### Out of scope (CMB-12 leftover)

Закрыто CMB-13 (pairing), CMB-14 (melee outcomes), CMB-15a–c (magic).
Дальше: CMB-18 outdoor `ATTACK` только после
явного решения. Quest-fight join — deny CMB-09. BG `FIGHT_JOIN` — CMB-16.
Practice history — CMB-17.

## CMB-13 — hunt N×N pairing

Срез закрыт (unit + raw-AMF). CEF 2026-09-17: сайдбар HP/`oppwait`, pair
grant до fight-auth, hunt N×N «Разозлить» + 3↔3. Product-status не
поднимать (bot AOE/MAGRES leftover). Очередь:
[ROADMAP.md](../migration/ROADMAP.md) CMB-18.

Seekers = unpaired living humans **и** bots обеих команд. Pair loop как
jgr: shuffle + last-foe score (`lastOpponentId`). Occupied spawn bot не
seeker (CMB-12: lone team-2 не крадёт бота).

«Разозлить»: outdoor hunt, цель — enemy bot по wire `targetId` (не
обязательно свой duel). Waiting/unpaired hunter клонирует чужого врага;
заряд `1+AGRILKA_MOBOV` на `HumanFighter`, не на команду. Ignore без
`native-count` нельзя отдавать waiting: клиент на `{rs}` делает
`aggro − 1`. Ephemeral clone в единую очередь `waiting` (jgr `waitingBots`);
`pairHuntQueues` снимает клон с очереди, если сразу спарили waiter-а.
Grant/bot-counter новой пары ставится сразу, даже если joiner ещё не
fight-auth; `oppnew` на poll — только authed, иначе первый auth. Auth
bootstrap `oppnew` — текущий duel foe, не primary spawn. Quest/copy/
friendly deny: fury + полный абсолютный `persSpells`, без −1 если заряд 0.
После гибели участника дуэли (моб, игрок, фантом — правило одно, `replaceFallen`)
его место занимает следующий своей команды: ждущий или игрок/моб из дуэли без игроков;
пара убившего получает клон (`oppnew`) (next actor = этот охотник, не fight
opener), бой не finish, пока жив хотя бы один enemy.
После `oppnew` смены моба grant ставится охотнику (`grantPairedBot`, human
opens), без bot-counter на нового моба. Убийство текущего бота при живой
чужой дуэли — `oppwait` кастеру, не finish и не throw на shuffle без пары.
После melee `persChangeInfo` (HP/`dead`) уходит остальным authed —
сайдбар тиммейтов и чужих врагов, не только текущий opp/`persSelf`.
Игрок, по которому пришёлся удар или спелл перчатки (дуэль против человека), получает сам удар
(`cast` с анимацией, без `attackwait` и без `persCP` ударившего), а затем `persChangeInfo`; остальные
участники боя — только `persChangeInfo`. Игрок напротив (пара) видит всё, что делает актор:
удары, лечение, `cast` баффов (ярость, предметы кармана) и эффекты; тиммейты — эффекты и HP.

Shuffle: после каждого удара и пропуска хода, если дуэль уже 3↔3. Waiter на команде —
`oppwait` актору и бот waiter-у; waiting enemy — `oppnew`; обе дуэли
3↔3 — **cross-swap**. Пока менять некого, hits **держатся**.
Shuffle один для всех боёв (`domain/duel-shuffle.ts`): участник — игрок или моб — не меняет правил.
После 3 ударов с обеих сторон ударивший уступает место ожидающему союзнику, либо его противника
заменяет следующий ожидающий враг, либо противники двух дуэлей меняются местами. Всем игрокам
затронутых дуэлей уходит `oppnew` / `opponent-new-human` / `oppwait`, ход открывает один игрок на
дуэль; мобы действуют по часам боя. Отличаются бои только флагами `FightRules` (`rotatesDuels`).
Павший или вышедший игрок заменяется так же для всех боёв (`replaceFallen`): ожидающий союзник его
команды (игрок или призванный моб) встаёт против его противника, обоим приходит `oppnew` /
`opponent-new-human`, павшему — `oppwait`; без союзника дуэль распускается, противник ждёт.
Окончание эффектов (`effPurge`, `effUse`) на бойце видят все игроки боя, удары — его пара.
Дружеская дуэль восстанавливает бойцов (`restoresFighters`): расходка кармана и сумки, потраченная
в ней, в БД не списывается (в бою счёт идёт в памяти). Призванный моб не делает дуэль «охотой»:
заголовок результата и история берутся по игрокам, пока в `historyRow` стоит `practice-humans`.
HP без сброса. Shuffle отменяет delay token **только затронутых** дуэлей
(`${fightId}:{min}:{max}` меняется вместе с id) и отдаёт ход охотникам
новой пары — без второго bot-counter сразу после смены. Чужие пары
свой bot-counter/grant сохраняют.
Этим же правилом (`replaceFallen`) место павшего моба или фантома занимает следующий своей команды;
при броске первого хода держит ход переживший (он только что действовал), новичок берёт его,
если бросок инициативы в его пользу. Ход моба в дуэли «моб↔моб» после трёх ударов тасуется
тем же `shuffleAfterHits`, что и ход игрока; дуэль с игроком тасует приложение по ходу игрока.

Новая пара из `tryPairQueues`, открывающая бой дуэль (герой↔первый моб, дуэль двух людей) и каждая дуэль, получившая нового соперника (следующий моб, вступивший ждущий игрок или моб, обмен при 3↔3 и ротация мобов) —
`rollOpensFirst` по инициативе (LUCK): шанс первого удара `(A + C) / (A + B + 2C)`, `C=80`
(`INITIATIVE_SOFT_C`, legacy; живая формула неизвестна). Больший LUCK бьёт первым чаще, но не
всегда, и у нуля против сильного тоже есть шанс. Инициатива моба — его `LUCK` из
бестиария/оверлея (`BotDefinition.initiative`, `catalog.bots.initiative`); у фантома идола — LUCK
предмета (у «до N маны» 0). Если открывает моб, герой ждёт, а ход моба стартует после входа игрока
(`aiOnlyDuelTurns`) или сразу после смены противника. Открывающий бросок идёт через отдельный `openingRandom` (в проде тот же
источник; в тестах `FixedRandom`: открывает герой). Дуэли союзников-мобов из квестового ростера
открывают союзники без броска. Delay token
`${fightId}:{min}:{max}`.

Не в срезе: dodge/crit (CMB-14), magic kinds (CMB-15), BG JOIN, assault/`FightRules`.

## CMB-14 — melee outcomes

Срез закрыт (unit + hunt raw-AMF без регресса). Product-status не
поднимать: CEF не прогонялся.
Очередь: [ROADMAP.md](../migration/ROADMAP.md) CMB-18.

Player L/C/R и bot melee: dodge → block → crit → DEF → HP (`legacy
behavior`, knobs на `BattleRules`: `combatSoftC=600`, cap 0.40, crit×2.35,
block 450/0.33, choke RAG/DEX/DEF). Wire `react` 1 dodge / 2 hit-or-block /
6 crit / 10 kill / 14 crit-kill. Шанс 0 не бросает RNG (unit secondaries
и unpublished bot RAG/DEX/DEF/BLOK = 0). Fatality/казнь — не этот срез.
Glove/pocket/kind-1 extra не критуют.

## CMB-15a — instant kind-1

Срез закрыт (unit). Product-status не поднимать: CEF не прогонялся.

Snapshot MAGSTR/MAGRES на старт/join (`heroMagPower`/`heroMagResist`,
bot twin). Naked MAGSTR/MAGRES в `hero_skills` нет: unpublished schools =
`{ power: 0, resist: 0 }` — не STR-as-magic. `rollMagicHit` invented:
catalog amount иначе STR/pcSTR как CMB-06, плюс MAGSTR, integer ±spread,
затем MAGRES soft-C `200` (`BattleRules.magresSoftC`, `legacy behavior`).
Магия не критует. Physical dmgType 1 и 256 не берут school MAGSTR.
Hissa 396 / 50101 `magic_direct` остаётся kind-1; Грызль melee-only.

## CMB-15b — kind-1 charging overlay

Срез закрыт (unit). Kind-1 с `dmgType !== 1` и capacity/charging > 0
не бьёт сразу: keep-turn, `schoolOverlay`, затем melee физика + второе
`hpChange` школы (`extraHits`), в том числе после dodge/block (`applied`
0, HP без изменения). Убийство физикой не жжёт заряд overlay.
Glove keep-turn баффы (crit 9100, overlay 181) вешают стоящий эффект: `effUse` несёт
свой `id`/`remainTime`, `effPurge` идёт на ударе, который расходует заряд (иначе
иконка висела вечно и делила `id` с DoT). Representative: Hissa 397, перчатка 181. Bot 397: `effUse` kind-3 на мобе
(catalog title/img) до `magic_baf`; overlay charges; `effPurge` после
последнего consuming melee. CEF 2026-09-17: иконка 397 на Хиссе.

## Хп и мана после боя

Бонус к максимуму на время боя (эликсир, максимум сценария) не остаётся: остаток хп и маны после
боя режется до настоящего максимума героя (`persistFightResources`), иначе сохранение результата
отклонялось бы и бой «висел» до конца таймера.

## Казнь

Убивающий удар с кнопкой «Ярость» (стоящий эффект 212 тратится на этом ударе) и сырым уроном ≥ 4×
hp жертвы до удара — казнь, если цель не выше удар­яющего больше чем на 1 уровень (моб) или на 10
(игрок). Условия из старого сервера; шанс там помечен как неизвестный, поэтому он наш:
`BattleRules.executionChance` (`config/*.json`, `combat.executionChance`, сейчас `0.5`) — шанс при
полной шкале ярости, умноженный на заполнение шкалы (0–100), которое несла кнопка «Ярость»
(заполнение восстанавливается из бонуса к силе обратной кривой `rageFillFromBonusPct`): полшкалы —
шанс вдвое меньше, 4% шкалы — около 2%. Бросок делается только когда все условия выполнены. На wire killing `hpChange` получает
`fatality: "<анимация>"` и `react 10`. Анимация — случайная из открытых по числу казней героя
(`execution-animation.ts`): 0 → `fatality1`, 50 → `fatality2`, 100 → `3`, 200 → `4`, 300 → `5`,
400 → `6`, 500 → `7`, 600 → `8`, 700 → `9`; текущая казнь входит в счёт. Счёт — казни прошлых боёв
(`CombatLoadout.lifetimeExecutions`, читается при входе в бой) плюс казни этого боя; у моба 0.

Награда за охоту платится **за каждого моба отдельно** (первый моб, разозлённые клоны, призванные
врагом): опыт делится по урону, нанесённому именно этому мобу, деньги и дроп уходят
тому, кто нанёс ему больше всех, правила пати применяются к каждому мобу сам по себе, в
бестиарий засчитывается каждый. Казнь удваивает опыт и деньги этого моба (дроп не меняется), только
если казнивший — тот, кто нанёс мобу больше всех урона: условие награды казнь не отменяет. Казнённый
игрок даёт ×2 к слагаемому героизма за урон по нему, остальные слагаемые не меняются.

## Стаки эффектов

Каждый каст — отдельный стоящий эффект со своим таймером и тиками: сто «Знаков жизни» на одной
цели тикают по сто раз, плоские навыки баффов (`STR`, `CRBonus` …) суммируются, ставки
(`DR`/`BR`/`CR`/`ANTI_STUN`) берут максимум. Второй эффект запрещает только сам каталог
(`targetRestr`): `artdeny` — тот же артикул, `groupdeny` — та же `groupId`, `selgroupdeny
{cond:true,id}` — цель под эффектом группы `id` (клиент проверяет это до отправки и показывает
тост; сервер при подделке отвечает тихим `{rs:false}` и ничего не накладывает). Каст игрока
никогда не заменяет эффект той же группы; запрещённый каст не тратит предмет и не запускает
перезарядку; карманный предмет можно использовать и ожидая противника (на себя или
союзника: противник ему не нужен); тот, на кого наложен эффект, получает и `effUse`, и `cast` с анимацией (`animData`
заклинания), а `effUse` тик-эффектов несёт `animData` и `flags` заклинания, как в живом дампе
(«Ветхий знак жизни»: `animData`, `flags 262144`, `groupId 841`); замена по группе осталась только у мобов
(`SpellPresentation.replacesGroup`), чтобы моб не копил свои баффы: книга моба не знает, что на
нём уже стоит.

## CMB-15c — remaining magic kinds

Срез закрыт (unit). Kind 2 heal — CMB-06. Kind 3 keep-turn / buff-cast.
Kind 4/5 живут на часах боя (модель подогнана к live-трассе
`_research/new_usable_session`, фикстура `tests/fixtures/combat/`): возраст
эффекта = реальное время + скачок каждого действия дуэли носителя
(`turnTimeoutSeconds − время, уже потраченное в ходе`, у ответа бота —
`meleeBotCounterMs`; это live `timeAdvance.span`, самого пакета j-emu не
шлёт). Тик k срабатывает, когда возраст пересёк `k·period`: на действии
(не больше одного на эффект, остаток ждёт следующего действия) или по
таймеру боя строго до истечения; тикает носитель **всегда**, в дуэли или нет, и когда никого рядом нет (общее правило владельца; ждущий участник тикает по таймеру боя, клиент видит тики своей дуэли), эффект
кончается при возрасте ≥ `duration` (`effPurge`, на самом моменте истечения
таймерного тика нет). Возраст идёт и у носителя вне дуэли. `period` и
`duration` обязательны и приходят из Pub1 (decoder `pub1-items/v4`), без
них бой падает; `castEndsTurn` — эффект наложен ходозавершающим кастом:
скачок этого же действия его не старит. Носитель — любой боец (человек или
бот). Тик приходит sibling `hpChange` (empty-anim `damage`) в ответе
действия либо отдельным пакетом с `pers-change`, если сработал таймер;
`persId`=кастер, `targetId`=носитель, HoT `react` 32. Kind-1+DoT: `effUse`
до `cast`, без тика в том же пакете. Тик, убивший бойца: конец боя, если
его команда пуста; бьющего охотника — hand-off ожидающему (как смерть от
бота); бота — следующий враг или ожидание; после последнего убийства тики
не идут. 396 (81/40): тики на 40-й и 80-й секундах, то есть на втором и
четвёртом действии после каста; CEF/дампа именно 396 нет. `winnerTeam`
выхода — команда против погибшего/ушедшего, не константа. Kind 8 dispel
стоящих `groupId` при gate `foe_has_dispel_groups`. Kind 11 empty
success. Kind 18 stun: `duration` обязателен, это число пропускаемых ходов. Ход
стоящего в стане бойца не выдаётся: бот бьёт снова (человек-соперник получает
ход) без событий; пропуск по стану в счётчик shuffle не идёт, а подряд идущие
ходы одного бойца считаются как один (`FightDuel.addHit`). Три AFK-таймаута
подряд (`maxConsecutiveSkips`, `BattleRules`, config `combat`) убивают
охотника: `turn-timeout`, затем конец боя, если он был последним, иначе
hand-off ожидающему. Любое ходозавершающее действие обнуляет серию. Kind 10 summon
632: `fight_start` сжигается без каста; clone цели в roster **не**
landed (явный skip). Period deadline без удара (~20s unpaired) — не
этот срез. Glove kind-1 AOE landed (CMB-02). Bot kind-1 `targetCount>=2` —
leftover: поле в spell, урон только текущему сопернику пары.

Не в срезе: outdoor `ATTACK`/`FightRules`. BG JOIN — CMB-16. Practice
history — CMB-17.

## CMB-16 — BG FIGHT_JOIN

Срез закрыт (raw-AMF). Product-status не поднимать: CEF не прогонялся.
Очередь: [ROADMAP.md](../migration/ROADMAP.md) CMB-18.

OA `FIGHT_JOIN` `{fight, team:1|2}` и `FIGHT_HELP` `{nick}` входят в
живой PvP Раскопа (`kind:"pvp"`, `purpose:"pvp"`) при том же `areaId` и
`instanceCopyId`, что у `Battle`. Тот же OA-handler, что hunt (CMB-11):
`joinHunt`, dump 204 через `asHelpFightError`. Friendly duel остаётся
deny «нельзя вмешаться в дуэль». Quest — CMB-09.

`startPvp` несёт `instanceCopyId` копии матча и `fightFlags` с
composition (combat battleground не импортирует). JOIN `fight|conf` —
`pvpConfiguration`: `is_pvp:1`, `type:"1"`, `can_leave:1`, тот же
`instance_id`/`flags`, что ATTACK. Leave в PvP copy разрешён (`FightRules.canLeave`);
dungeon hunt copy — нет.

Seekers JOIN — waiting humans (`pairHuntQueues`, roster `null`).
Стартовая 1v1 PvP-пара не seeker. Team-1 waiter без unpaired team-2
ждёт; JOIN противоположной team сразу human↔human (`oppnew`,
`bot !== true`). A↔B продолжают свою дуэль. Bootstrap PvP-joiner:
`friendly-bootstrap` `pvp:true`, `persList` всех людей; unpaired —
`oppwait`.

Dump 204: другая локация/копия; stale/missing fight. Restart процесса
уничтожает RAM бой: JOIN после restart — 204, без resurrect.

### Out of scope (CMB-16 leftover)

CMB-18 outdoor `ATTACK` / `FightRules`. Третий герой в Раскопе не член
матча — test teleport в копию; kick orphan на restart уже BG-01.

## CMB-17 — Practice fight history

Срез закрыт (raw-AMF). Product-status не поднимать: CEF не прогонялся.
Очередь: [ROADMAP.md](../migration/ROADMAP.md) CMB-18.

OA `arena|finished_fights` читает PostgreSQL `combat.finished_fights`
через `CombatPort.listFinishedFights`. Не `BattlegroundDesk` и не
`arena|bg_finished`. Клиент не шлёт `area_id`: сервер фильтрует по
текущей локации героя. Доска локации, не только свои бои. Form:
`nick`, `type`, `level_min`, `level_max`, `page` (1-based, default 1).
Ответ: `status:100`, `page` 0-based, `page_count`, `total_items`,
`fights[]`. Page size 10. `winner` и `duration` на wire — строки
(storage integer, ADR-0015/0020). Viewer `teams.*.me`. Невалидный
integer form — 203.

Practice terminal пишет `type:6`, title `Нападение {challenger} на
{acceptor}`, teams human↔human, `ml_title` `{challengerLevel}|{heroId}|{challengerLevel}`
(jgr fallback без ботов). Hunt `type:1` human↔bot без изменения.
Retention 72h в SELECT; cleanup batches вне request path. PvP в history
не пишется.

### Architecture decision

ADR-0017–0020 достаточны для этого среза. «Не выделять `FightRules`» — **устарело**: `FightRules` и `FightSetup` выделены в
`ARC-CMB` ([ROADMAP.md](../migration/ROADMAP.md)).

### Out of scope (CMB-17 leftover)

PvP type 1 history rows; outdoor `ATTACK` / `FightRules` (CMB-18).
Live chrome `fight_info` (Pub1 Handlebars / archive log) — не этот срез.

## CMB-17 leftover — Live board and test fight card

OA `arena|runned_fights` читает **RAM** `CombatService` через
`CombatPort.listRunnedFights`. Тот же form/page, что `finished_fights`.
Список — текущий `hero.areaId`, незавершённые бои. Hunt `type:1`,
practice `type:6`. `winner` на wire **нет** (бой ещё идёт). `duration` —
прошедшие секунды строкой. Viewer `teams.*.me`. Пустая доска —
`page_count:0`. Restart процесса очищает доску (ADR-0020). Невалидный
form integer — 203.

GET `/fight_info.php?fight_id=` — тестовая HTML-карточка, не live chrome.
Сначала RAM, иначе `combat.finished_fights` с тем же cutoff 72h.
Невалидный `fight_id` — 400. Нет строки — 200 HTML «Бой не найден».
Jugger-wire не читает таблицу напрямую.

### Architecture decision

ADR-0017–0020 достаточны для этого среза. «Не выделять `FightRules`» — **устарело**: `FightRules` и `FightSetup` выделены в
`ARC-CMB` ([ROADMAP.md](../migration/ROADMAP.md)).

## HERO-01 — PvP honor snapshot

Combat не считает героизм и не пишет `heroes.honor`. На terminal PvP
(`purpose:"pvp"`) snapshot отдаёт humans: `level`, `maxHp`,
applied урон по вражеским людям (`damageToHumans` и по жертвам `damageByVictim`: хилы раздувают
сумму; кредит как jgr-emu `applied`, не `damageToBot`), `winnerTeam`.
Все human-hits (melee + glove ending) идут через
`applyDamageToMeleeTarget`.
Героизм считается по урону **по игрокам** (урон по мобам и фантомам не входит), отдельно по каждой
жертве: `round(Σ Base(ур. жертвы) × урон_жертве / hpMax_жертвы × (1.4 победа | 0.8 поражение))`.
Это работает в любом PvP-бою с любым числом участников (`damageByVictim` в снимке исхода).
Отхил **других** игроков (тик «Знака жизни» и т.п., `creditHealed`; свой отхил не считается
нигде) даёт `healShare = 0.5` от ставки урона: 10 урона → 2, 10 отхила → 1; ставка по уровню и
`hpMax` вылеченного, тот же множитель победы/поражения, фактически восстановленные hp (без
перелечивания). Сумма отхила по людям идёт в колонку `heal` итогов боя, героизм — в колонку `honor` (`FightSettlement.honorOf`; бой без героизма даёт 0). Лечебные знаки (kind 5)
из кармана ложатся на кликнутого свою сторону (или на себя) через `targetId`; на ждущего
союзника эффект тикает сразу, как у всех. Мгновенный отхил (kind 2, «Регенерация», «Исцеление амазонок»)
ложится на кликнутого союзника; заклинание без клика (`randTarget`, «АОЕ хилл») само берёт до
`targetCount` (без него 8) своих; отхил по другому записывается лекарю (`creditHealed`). Бонус за добивание игрока не реализован: его таблица совпадает
с `Base` (уровень → героизм), уже вошедшей в формулу, и сверена с дампом Раскопа без добавки. Hunt/quest/friendly не грантят героизм; `fight|loot.honor` остаётся 0.
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
Dialog `START_FIGHT` — QST-ENG-01; AREA leftover
`START_FIGHT` `mode:"quest"` — QST-ENG-02; ambush без `mode` — QST-ENG-04
(`QuestDesk`, не combat). Roster — `CMB-10`.

### Architecture decision

ADR-0017–0020 достаточны. `ARC-*` нет. Active fight RAM; restart без
`on_win`/`on_lose`.

### Out of scope (CMB-09 leftover)

`on_win`/`on_lose` scripts сверх terminal notice; `progress_on_win:false`;
curated Акрилон.

## CMB-10 — Quest fight roster

Landed raw-AMF. Product-status не менять здесь. Очередь:
[ROADMAP.md](../migration/ROADMAP.md) CMB-10 (`done`).

`startQuestFight` поднимает весь authored `enemies[]`/`allies[]` (`count`
копий). `purpose:"quest"`: `fight|conf.flags:"8"`, `win_fight` после победы.
`FightRules.skipQuestKills` на старте: ростер больше одного бота не шлёт
kill-signal, чтобы не бампить чужие `kill`; 1v1 quest-fight по-прежнему
бампит kill (`q_engine_fight`). Ally/enemy боты — ephemeral IDs, тот же `FightDuel`,
bot↔bot. `chat_*` — ChatDesk после start / terminal. Синтетика
`q_engine_roster` (bots 2+32 vs ally 4). Акрилон 83–90 не этот срез. Deny
leave — QST-ENG-04. CEF leftover
([CEF_MANUAL.md](../migration/CEF_MANUAL.md)).

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
боя только меняет location. В бою layout — `requireNoActiveFight` `203` «нельзя во
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

## Решение бота и самоналоженные бафы

- Бот выбирает действие через `BotBrain.decide(CombatSnapshot, random)`: `cast(card)` или `melee`.
  `CombatSnapshot` — всё, что видит ИИ: своё HP, стоящие группы эффектов противника по дуэли и
  собственный журнал кастов (его единственное изменяемое состояние). Боя целиком ИИ не видит.
- `SpellBookBotBrain` — книга заклинаний каталога (fight_start → prefer → weighted roulette).
  Тот же путь у бота против человека и бота против бота; противник в дуэли — любой `Fighter`,
  поэтому `foe_has_dispel_groups` и kind 8 работают и против бота. Декларативные энкаунтеры
  (этап 9) — другие реализации `BotBrain`; подменяемого внедрения в `BotFighter` пока нет (план).
- Самоналоженный баф, который тратится следующими ударами (карманный шар kind 3, перчатка,
  ярость, оверлей школы бота), ставится и объявляется одним `castChargingBuff`: стоящий эффект с
  id, затем `effUse`, затем `cast` носителя.

## Участники боя — общая read-поверхность

`Combatant` (`id`, `team`, `maxHp`, `mag`, `strikeStats`, `alive`) — то, что
человек и бот отдают одинаково; оба варианта `MeleeTarget` его включают, а
строятся только фабриками `humanMeleeTarget` / `botMeleeTarget`. Человек и
hunt-бот мутируют hp на живом объекте (`HumanFighter.applyDamage` /
`BotFighter.applyDamage`). `enemySideCleared` принимает один список
`Combatant` и смотрит `alive` на стороне: для человека это `hp > 0` и не
`leftLive`, для бота — `hp > 0`.

hp в `Combatant` намеренно нет: единственный ридер — `targetHp`, который идёт
по живому участнику. Overlay и react-kill читают его уже после основного
удара, поэтому добивание и догоняющий overlay считают от того же hp, что и до
унификации. Копия hp на wrap отдавала бы значение **до** удара и повторила бы
тот дефект, из-за которого снимали `BotMeleePresence`.

## FightSetup

Канонический вход в бой: `FightSetup { meta, teams }`. `Battle` принимает
его целиком; три прежние init-формы (`HuntBattleInit`,
`FriendlyDuelBattleInit`, `HuntJoinHuman`) сняты.

`meta.kind` — тот же union, что `FightRules.for({ kind })`:
`hunt | quest | friendly-duel | pvp`. Плюс обязательные `fightId`,
`accessKey`, `arena`, `areaId`, `startedAt`; `instanceCopyId` и
`fightFlags` — легитимный `null` (hunt/quest/friendly-duel в мире), не
отсутствие поля. PvP требует положительный copy id и nonempty flags.
`chatWin` / `chatLose` — обязательные строки (пусто — валидно); наружу в
`FightFinishedNotice` уходят только при `FightRules.includesQuestChat`.

`teams[1]` и `teams[2]` — списки участников. Человек:
`controller:"human"` плюс статы, `loadout` и `appearance:{avatar,body,sk}`.
AI: `controller:"ai"` плюс поля `BotFighterSeed` (`fightId`,
`artikulId`, `nick`, `hp`, статы, `avatar`/`sk`/`body`, `spellBook`).
Команда человека и бота задаётся слотом в `teams`, не плоским префиксом.

Кто собирает. Адаптеры на границе старта: `fightSetupFromHuntStart`
(`HuntStartInput` → opener human на `teamAssignment.openerTeam`, primary
bot и `extraEnemies` на enemy, `allies` на opener),
`fightSetupFromHumanDuel` (challenger/acceptor, внешность из плоских
`avatar`/`body`/`sk` порта). Добор: `fightSetupJoinFromInput` даёт
`FightSetupJoin` = тот же human + `team` + `startedAtMs` с часов на join,
не `meta.startedAt`.

Невалидный setup — явная ошибка в `requireFightSetup` до сида:
неизвестный `kind`/`controller`, пустые обязательные строки, коллизия
`heroId`/`fightId`, бот ниже `1_000_000`, hunt с side-bots при
`!allowsSideBots`, PvP без copy/flags. `seedBattleParticipants` кладёт
людей и ботов на один `Battle`: `bots: BotFighter[]` (пустой список,
если `hasEnemyBots === false`; не null). Primary-враг — первый AI на
`teamAssignment.enemyTeam` (сид кладёт enemy AIs раньше союзников).

`Battle.purpose` = `meta.kind` и кормит `FightStart.purpose` /
`FightFinishedNotice.purpose` (те же четыре строки). Отдельного
`Battle.kind` нет: `wireFightTypeOf(meta.kind)` даёт `"1"` для hunt, quest
и pvp и `"6"` для friendly-duel.

## Паринг и цикл ходов

Один список дуэлей: все `FightDuel` живут в `Battle.duels` — human↔bot,
human↔human и bot↔bot. Отдельного `HuntRoster.extraDuels` нет.

Одна очередь «ждёт пару»: флаг `waiting` на человеке и на боте. Seekers
собирает `huntSeekers` из обоих, живость — `Combatant.alive`, не
отдельный `hp > 0 && !leftLive`. Join, aggro-клон и shuffle (в том числе
`oppnew` / reserve-swap) паруют через тот же `pairHuntQueues` /
`nextInLine`. Новая пара из очереди —
`rollOpensFirst`. Квестовый leftover ally↔enemy на сиде — отдельный
`pairLeftoverRosterBots`: opener всегда союзник, без броска инициативы
(байт-в-байт со старым конструктором roster).

Один планировщик AI-хода: `resolveAiActorTurn`. Чей ход — смотрит
контроллера: человек ждёт команду (melee-loop), бот зовёт AI. Формулы
удара не слиты: бот→человек — `resolveBotTurn` (`keepFightOnKill` по
живым тиммейтам цели); бот→бот — `resolveRosterBotTurn` (`keepFightOnKill:
true`, смерть в extra-дуэли не эмитит fight-finished). Bulk-tick
bot↔bot (`tickHuntRosterDuels` / `Battle.tickRosterDuels`) идёт сразу
после человеческого удара; bot→человек по-прежнему с `meleeBotCounterMs`.

Боты живут на `Battle.bots`, не в nullable `HuntRoster`. Поиск по
`fightId` — `requireFightBot` (miss — «fight bot X is missing»).
Primary-враг для истории, join-snap и unpaired authenticate —
`primaryEnemyBot` (первый `team === enemyTeam`). Aggro-клон —
`enqueueAggroClone`: копия в список, сразу `waiting`, затем общий
`pairHuntQueues`. `HuntRoster.enemySideCleared` снят: канон —
`enemySideCleared(team, combatants)` из списка `Combatant`. Authenticate
дуэли и охоты различает `FightRules.hasEnemyBots`, не отсутствие списка.

`BotFighter` остаётся live-объектом AI (melee, спеллы, aggro-клон,
wire snap). Его не сливают с `HumanFighter`: `Combatant` — общая
read-поверхность.

## FightRules

`BattleRules` — числовой тюнинг боя (STR/урон, crit, таймауты).
`FightRules` — versioned policy разрешений и следствий типа боя (`version: 1`).
`requireNoActiveFight` — запрет действий во время боя (`203`); контракт
layout — [INVENTORY.md](INVENTORY.md), travel — [WORLD.md](WORLD.md).

Конструируется явно на границе старта: `createHuntBattle` /
`startHumanDuelBattle` вызывают `FightRules.for({ kind })` и передают
экземпляр в `Battle`. Domain не выводит правило из `purpose`. Нет полей
по умолчанию и нет «безопасного» варианта на неизвестный тип: неизвестный
`kind`, отсутствующий экземпляр, неизвестная `version` — явная ошибка.

Следствия, не ярлыки типа боя: `teamAssignment` (quest opener 2 / enemy 1);
`humanJoin` `hunt-roster` / `pvp-humans` / `denied`+причина; `canLeave` и
`canAggro` (у hunt пекутся из `instanceCopyId === null`); `skipQuestKills`
(квест с одним ботом кредитует киллы, с несколькими — нет: стартовый
`botCount > 1`, не live roster); `allowsSideBots`; `hasEnemyBots` (ходы бота, title
результата, botId в notice; `historyRow` `"hunt-bot"` выводится из него);
`awardsHonor` / `restoresFighters`; `historyRow` (`hunt-bot` /
`practice-humans` / `none`); `includesQuestChat`.

Wire `type` `"6"` дружеская дуэль / `"1"` hunt, quest и pvp собирает
`wireFightTypeOf(meta.kind)` на границе ответа (`fight-result-info`,
`runned-fight-record`), не `FightRules`. `Battle.purpose` =
`FightSetup.meta.kind` и уходит в settlement/notice без смены строк.
Решения в domain читают `FightRules`.

## Инженерный долг

Каноническое место для долга боевки. Ничего из списка не меняет продуктовый
статус capability и не является known bug на wire — это стоимость
эксплуатации и поддержки. Архитектурная часть (состав боя, `FightRules`) —
не здесь, а в `ARC-CMB` ([ROADMAP.md](../migration/ROADMAP.md)).

**Read path доски боёв.** `PostgresFinishedFightStore.listByArea` выбирает
все строки area за окно retention без `LIMIT`, а `FinishedFightList.list`
применяет фильтры `type` / `level_min` / `level_max` / `nick` и режет
страницу в памяти. Индексов под `type` и уровни нет, потому что фильтры до
SQL не доходят; поиск по нику разбирает jsonb `teams` каждой строки. На
плотной локации это всё окно на каждый запрос доски.

**Память о завершённых боях.** Записи завершённого боя (`CombatService.settledFights` и
`exitSent`, `HuntFightSettlement.finished` / `left` / `deathBreaks`, `PvpFightHonorCache`,
`ChatFightSettlement.pendingEnded`) лежат в `TtlMap` и забываются через срок хранения истории
(`FINISHED_FIGHT_RETENTION_MS`, 72 ч); устаревшее вычищается при записи. Бой, который бросил
клиент, заканчивается сам: три пропущенных хода подряд убивают бойца (`maxConsecutiveSkips`), а
очередь событий и итог игрока ждут его возвращения (одна запись на аккаунт, не на бой).
Вне TTL остаются только ограниченные по числу аккаунтов карты (`pendingExits`, `pendingLoot`,
`pendingFightInfo`, `queues`).

**Settlement.** Награда охоты разложена: `hunt-reward-plan.ts` — чистый расчёт (бросок
опыта/денег/дропа, раздел по правилам группы, золото бойца), `HuntFightSettlement.rewardHuman` —
запись одному бойцу. Охота, квест, PvP и ранний выход мёртвым пишут человеку одно и то же
в одном порядке: HP/мана, death durability, refill кармана (`persistFoughtHuman`). Дальше
охота добавляет EXP, деньги и дропы. Дружеская дуэль этот шаг не вызывает: она откатывает
HP, ману и карман. Внутри одной транзакции по-прежнему цикл по игрокам с отдельными await,
плюс `capRolledDrops` с запросом на каждый дроп — это самое долгое удержание транзакции.

**History write — принятый риск, без наблюдаемости.** Решение CMB-03
(«history best-effort не откатывает награду») в силе и не отменяется:
`CombatTerminal.recordHistory` логирует сбой и не роняет бой. Долг в том,
что сбой уходит только в stderr через `StructuredHistoryWriteObserver` —
нет ни retry, ни счётчика, поэтому расхождение «награда выдана, строки нет»
незаметно в эксплуатации.

**Стоимость HTTP fproxy.** `FproxyRouteRegistrar` аутентифицирует каждый
запрос, включая каждый long-poll: `sessions.findById` + `accounts.findById`.
При `FPROXY_POLL_MS=2500` это два SELECT на бойца каждые 2.5 с. TCP-путь
(`FightTcpConnection`) держит accountId на соединении и не платит.

**Расход кармана не атомарен.** Combat складывает id в
`pendingPocketConsume`, роут отдельно берёт его и делает свою транзакцию.
Сбой транзакции оставляет предмет потраченным в RAM боя и целым в БД.

**Опциональные порты.** `bindSettlement` / `bindWake` /
`bindTerminalObserver` вызываются после конструктора, а на месте
использования проверяются как опциональные (`if (!settlement) return`,
`wakePort?.wake`). В composition root все привязаны, но ошибка сборки даст
тихую деградацию вместо fail-fast.

**Молчаливый production RNG.** `CombatModule.create` подставляет
`input.random ?? new SystemRandomSource()`, а `CompositionRoot.build` то же
самое для `lootRandom` / `upgradeRandom` / `wanderRandom` / `farmRandom` /
`partyRandom` / `ambushRandom`. Пропущенный `extras.combatRandom` не
fail-fast, а уходит в `Math.random`; e2e с точной долей урона из-за этого
мигают и маскируют регресс. Лечение: обязательный `RandomSource` без `??`,
явная ошибка в composition, если extra не передали.

**Battleground.** `PostgresBattlegroundHistory.list` делает запрос игроков
на каждую строку страницы; под фактический `WHERE bg_id` +
`ORDER BY time_finish` индекса нет (есть только `uniqueIndex(copy_id)`).

**Хардкод контента в domain.** ID ярости `212` и группа `844` с title и png
лежат в `player-casts.ts` и дублируются в `hunt-native-pers-spells.ts`;
`DOT_DURATION_TURNS` держит override спелла `396`. Должно приходить из
каталога.

**Размер файлов.** `battle.ts` у лимита 400, рядом `combat-service.ts` и
`combat-melee-loop.ts`. `ARC-CMB` закрыт и этот долг не снимал.

## Границы модулей

Combat получает immutable combat-ready snapshots через public ports; catalog
и inventory не импортируются как repositories внутрь fight engine. Settlement
вызывает owning application ports из composition после terminal outcome.

Не создавать generic «будущий» battle abstraction спекулятивно и ценой
изменения работающего flow: механики переносятся capability за capability.
`ARC-CMB` landed: абстракция — `FightRules` + `FightSetup`, поведение и wire
не менялись; порядок миграции и acceptance — в записи.

## Acceptance будущей полной combat wave

- полный hunt fight проходит в клиенте без timeout/hang;
- pocket/glove/native counters не списываются дважды;
- win/loss/leave дают правильные terminal packets и durable state;
- restart прекращает active fight без partial settlement;
- reconnect до restart восстанавливает wire state;
- DB не получает writes на каждый strike/poll.

## Выход из боя и «Разозлить»

- **Выход из боя, который идёт дальше** (`leaveFight`, живые остаются): ответ `rs:true`, герой
  помечен вышедшим, ему сразу строится результат (`fight|finish` отдаёт `fight|info`, таблица
  «в процессе», `finished:0`) и уходит `fight|exit` (`flee`, `type:2`). Событий боя он больше не
  получает. Когда бой кончается, он получает exp, деньги и дроп как обычно (где бы ни был),
  `fight|loot` и строку «Окончен бой». В тот же бой вернуться нельзя («вы уже участвовали в этом
  бою»). e2e `tests/e2e/fight-leave.test.ts`.
- Квестовый бой и копии: выход запрещён живому (`rs:false`), павший выйти может; `can_leave:0` в
  конфиге боя, диалога выхода у клиента нет.
- Кнопка «Разозлить» (`srcId 7`) есть в `persSpells` только там, где `FightRules.canAggro`
  (охота в мире); в квестовом, дуэли и PvP её нет. Призванного (идол, позже спутник) разозлить
  нельзя никогда (`BotFighter.summoned`), как и моба своей команды.

## «Концентрация» (native «Удар в спину», `srcId 5`)

Клиентская метка `fightBackstabLabel` = «Концентрация»; по офсайту: пока герой жив и ждёт
противника, он периодически бьёт случайного живого врага; очки урона идут в опыт и героизм.
Что делает спелл, сказано в мете артикула 487: kind 1, `dmgType 256`, `pcSTR −90`, `cooldown 90`,
`persRestr noopp` (только без противника). Реализация: `castSpell srcType 1 srcId 5` → `concentrate`
(`domain/concentration.ts`): спелл берётся из каталога и кладётся в `CombatLoadout.concentration`
(нет артикула 487 — бой не стартует); ждущий живой участник бьёт случайного живого врага тем же
magic-hit, что и любой kind-1 спелл (сила × 0.1, разброс, min 1), `cast animData magic_backstab`;
урон засчитан как свой (`damageToBot`/`damageToHumans`, из них опыт и PvP-героизм), убитого
разбирает `settleFallen`. Ход не тратится. У ботов `concentration: null` — её нет.

Клиентская сторона (разбор `main_unity_flash.swf` и `FRCOppWaitCommand`/`FRCgcdEndCommand`): фаза
«концентрация» (`PREPARING_BACKSTAB`, полоска до готовности) начинается, когда герой ждёт
(`oppwait`) и клиент вышел из состояния «пара создаётся» (`InPairCreating`). Выводит из него
`oppnew`, `gcdend` или запись `persSpells` с `cdInterval`. Поэтому для героя, который стартует без
противника, bootstrap шлёт `gcdend` сразу после `oppwait`; иначе остаётся плашка ожидания.
Кулдаун клиент ведёт сам (`cooldown 90` из `persSpells`), после каста перезапускает.

## Разбор боевой части клиента: что клиент умеет, а сервер ещё нет

Источник: декомпилят `main` (`services/fight`, `model/genericDataStructures/CombatCharacterInfo`,
`modules/fightmembers`). Unity-рендерер исходниками не представлен. Всё ниже — **план**, в runtime
этого нет.

Правила клиента, которые уже важны сервису:

- `hpChange` клиент считает как `hp += hp` строки, а `persChangeInfo`, `persSelf` и `briefPersUpdate`
  ставят **абсолютное** значение. Поэтому в одной доставке изменение идёт раньше итога (иначе хил
  прибавится дважды: было 213 из 200). Так устроены тики таймера (`battle-effect-clock.ts`).
- `drain` и `deflect` строки `hpChange` клиент сам разворачивает в отдельное изменение на
  атакующего. Сервер второй `hpChange` не шлёт. Ярость строки учитывается один раз на каст (по `link`).
- Конец оглушения клиент рисует сам: на `effPurge` эффекта `kind 18` он проигрывает
  `global_magic_baf_stun_post_2_end` по `persId`/`sourceId` ранее присланного `effUse`. Наш
  `effUse` оглушения их несёт, отдельной работы нет.
- Выбранного бойца клиент опрашивает `persEff` каждые 5 секунд (поддержано).

Не сделано, по убыванию близости:

| Что                                       | Что видит клиент                                                                                                                                            | Заметки                                                                                                                                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Воскрешение и подтверждение               | `msg` с типом `CONFIRM_USE`: диалог «игрок X применяет на вас…, согласны?», ответ `sendMessage` типа `USE_EFFECT` (1 — да); затем `resurrect` с `pers`      | Воскресить в бою можно знаком воскрешения. Вещи после боя у воскрешённого всё равно портятся. Кадров `msg`/`resurrect` и команды `sendMessage` у нас нет                       |
| Берсерк                                   | `berserk` в `persChangeInfo`/`briefPersUpdate`; при `3` ник жирный, Unity (`US_BERSERK`) увеличивает модель (~+0.2); баффы по описанию игрока               | По дампам `berserk:1` приходит у убийцы сразу после добивающего удара; значит поле — счётчик добитых. Условие `3`: добивание трёх разных игроков в одном бою. Баффы неизвестны |
| Спутники, питомцы (`castBot`, `srcId 10`) | `castBot` с `srcId`/`block`, `castSpell srcId 10` с `sputnik`; `companions` в `persSelf`; кадры `petblock`/`opppetblock`/`petblockdrop`, поле `pet` у бойца | Сейчас `status:203`. Источников кроме дампов сайта и `strangers` нет; делать после доведения боевки                                                                            |
| `persBlock`, `briefPersUpdate`            | `persBlock` передаёт Unity параметр `block`; `briefPersUpdate` — абсолютные hp/mp/`berserk` одного бойца                                                    | В живых трассах не встречаются                                                                                                                                                 |

Премиум и скорость анимации: ускорение — настройка клиента. Артикул-премиум (`typeID` премиума) с
навыком `BATTLE_SPEEDUP > 0` включает слайдер 1…1.4 (`Config.MAX_COMBAT_SPEED_MULTIPLIER`), клиент
шлёт Unity `US_ANIMATION_SPEED_MULTIPLIER`. Таймеры хода и боя на сервере не меняются; от сервера
нужен только сам артикул премиума в инвентаре героя. Кадр `timeAdvance` (`span`) клиент не
обрабатывает (пустая команда).

## Знаки отличия: щит эмблемы (kind 9)

- Эмблема в слоте знака отличия (`INVENTORY.md`) попадает в `CombatLoadout.emblems`, не в
  `gearSpells`. Карточку читает `emblemPlanOf`: играется семейство со щитом `PVP_SHIELD` (kind 9
  без `duration`, при желании с kind 3 бафом на борту) и условиями `randomly`, `lowSelfHP`,
  `selfActive`; остальные (печати с `cooldown`, дебафы на врага) эмблема не играет, бой пишет
  `unsupported_emblem` и продолжает.
- Условия проверяются в начале хода героя (`runGrant`, до `turn-granted`): группа срабатывает, когда
  выполнены все её условия; условия без броска идут первыми. `onlyPvP` — только в бою, где людей
  есть в обеих командах. Всего `triggerCount` срабатываний за бой.
- Карточка называет только ступень `randomly.probability`; шанс — наш:
  `combat.emblemChances` (индекс 0 — ступень 1): `[0.4, 0.8]`. Неизвестная ступень — ошибка.
- Щит живёт до конца боя или пока не исчерпан: размер `abs + proc × PVP_SHIELD` карточки, `limit` —
  доля удара в процентах, которую он принимает, `dmgMask` — какие типы урона. Принимает
  `FighterEffects.takenDamage` (физические и магические удары, глиф-заклинания, DoT-тики); на wire: `effUse kind 9` с `amount`, `hpChange` без потери HP и `absorb`, `effPurge`,
  когда щит пуст. Урон по таймеру хода и самоурон от вампиризма щит не принимают.
- Не сделано: щиты заклинаний перчатки (kind 9 с `duration` и размером от силы), печати (`20291`,
  `20292`), чужие слоты второй маски.
