# Combat

## Статус

Есть hunt melee loop (raw-AMF L/C/R, delay grant/bot-counter, kill, waiter
re-pair), map `joinHunt` и CMB-02 pocket/glove/rage casts. Terminal
HP/EXP/loot persist — CMB-03. Shuffle 3↔3 не в этом срезе. CEF кнопок и
счётчиков пояса не подтверждался — product status combat остаётся частично.

## Источники поведения

Основной lifecycle:

- `jgr-emu/docs/FIGHT_MODEL.md`;
- `jgr-emu/docs/FIGHT_CAST_ACK.md`;
- `jgr-emu/docs/FIGHT_LOOT.md`;
- `jgr-emu/docs/FIGHT_RECONNECT.md`;
- `jgr-emu/docs/FIGHT_TOASTS.md`.

Механики: `FIGHT_TURN_UI`, `FIGHT_RAGE`, `FIGHT_JOIN`, `FIGHT_LOCK`, `POCKET`,
`GLOVE_MAGIC`, `BOT_SPELLS`.

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
   `fight|exit` в одном `2:` object. Сейчас exit без loot/HP persist.

Inventory layout lock (`PUT_ON`/`PUT_OFF`/`DROP`/`SELL` → `203` в бою) —
именованное `FightRules` в [INVENTORY.md](INVENTORY.md), не live. Live
[FIGHT_LOCK.md](../../../jgr-emu/docs/FIGHT_LOCK.md) эти коды не режет.
Трата из кармана — fproxy. World USE, COME_IN/`common|exit` и ATTACK — live
`fightBusy`; WLD-01 применяет то же `FightRules` `203`. Карта ATTACK_BOT:
ключ — spawn id; занятая живая точка — `joinHunt` team 1. OA `FIGHT_JOIN` /
`FIGHT_HELP` не входят. Live `10_000_000 + heroes.id` в `userId` не копировать
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
`ManualCombatDelay`, без `sleep`. `Clock.schedule` нет. Урон — `BattleRules`
min/max, `damageProvenance: legacy behavior`.

Join/waiter WLD-02 не ломается: пока A в дуэли, B без `attacknow`/`oppnew`.
Если A умер и бот жив — authed B получает `oppnew`, затем `attacknow`.

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
`noteHp` пишет fight HP как есть, в том числе `0`; ghost/injury — CMB-04.

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
fight заканчивается. `chat|add` «Вами получено» — post-core. `fight|finish`
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

### Out of scope

Ghost/injury/RESURRECT (`CMB-04`); quest loot; party split; dungeon bands;
system chat; reconnect mid-fight; `Clock.schedule`; OA FIGHT_JOIN/HELP;
live `10_000_000+hero.id`.

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
