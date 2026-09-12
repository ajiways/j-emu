# Архитектурная эволюция переноса

Этот документ перечисляет известные точки, где следующая capability может
потребовать изменения общей архитектуры. Он не задаёт будущие private classes
или таблицы и не разрешает refactor заранее.

Текущий проверенный checkpoint — готовые bootstrap, paperdoll PUT_ON/PUT_OFF,
internal CHR-01 `grantExperience`, internal CHR-02 `syncResources`/`noteHp` и
INV-02 bag DROP/`creditMoney`, INV-03 pocket layout 93/99, INV-04 world USE
77 ADD_HP, WLD-01 area transitions 503↔501/504, RTM-01 presence roster,
WLD-02 hunt overlay + map `joinHunt`, WLD-03 hunt wander on shared `DelayScheduler`, CMB-01 melee delay port и CMB-02
pocket/glove/rage loadout: persistent state в PostgreSQL; esrv delivery и hunt
overlay process-local; active content через release projections; active combat
в RAM (несколько accounts на один fight id, `CombatDelay` не `Clock.schedule`;
HTTPS fproxy consume кармана после успеха). CMB-03 landed: composition UoW
на terminal, catalog `bots` rewards + `bot_loot_entries`, esrv loot-then-exit.
CMB-04 landed: init2 `fight|conf` overlay на тот же RAM battle и character
ghost/injury/`RESURRECT`, без таблиц active fight. ECO-01/ECO-02 landed: catalog
витрина 504 type `-131` lots 23/24 и 552 type 11 lot 438/621 RANK, jsonb
`pay`/`requires`, character `debitMoney`/`debitMoneyGold`, composition
`StorePurchase`. REP-01 landed: catalog track 5, `hero_reputations`, OA
`user|stats`. INV-05 landed: instance durability columns, death −1 on
settlement, composition `StoreRepair`. INV-06 landed: instance upgrade
overlay columns, catalog crystals 553/1310/4603/11408/13224, OA `UPGRADE`.
HERO-01 landed: composition `persistPvpHonor`, character `honor_grants` /
`grantHonor`, live `honorProgress` on unitframe/conf, BG RAM match sum.
DAY-01 landed: lazy Moscow 06:00 catch-up, `hero_quests.hidden_in_journal`,
cycle-aware quest EXP `operationId`.
EDT-01 landed: operator HTTP `/operator/content/*`, candidates /
validation reports / publication audits, `CONTENT_OPERATOR_TOKEN`.
EDT-02 landed: GET document/keys from active `release_entries`; six
extended-type overlays; matching bootstrap `seed()` restores pointer.
Фактическая схема описана в [DATA_MODEL.md](../architecture/DATA_MODEL.md).

## Как принимается изменение

Перед capability architecture agent сверяет её с картой ниже. Возможны только
три результата:

1. текущих boundaries и ADR достаточно — checkpoint фиксирует используемые
   ports и transaction boundary;
2. нужен ограниченный refactor внутри владельца — он входит в capability и
   отдельно виден в её плане;
3. меняется ownership, cross-module transaction, process lifetime или
   publication model — перед capability в [ROADMAP.md](ROADMAP.md) добавляется
   блокирующий `ARC-*`.

`ARC-*` содержит evidence, current/target data flow, порядок миграции,
совместимость wire и данных, rollback, acceptance и список разблокируемых
capabilities. После его выполнения продуктовый статус не повышается: статус
меняет только пользовательский сценарий.

## Известные точки пересмотра

### `ARC-DATA` — от одного bootstrap bundle к corpus manifests

**Сейчас:** один `playable-slice/v8` parser публикует минимальные catalog/world
rows с обязательными artifact `priceMinor`/`flags`/`bagStack`. DATA-02 remains
the later corpus importer.

**Давление:** DATA-02…DATA-06 требуют нескольких независимых binary/JSON
decoders, dependency DAG, provenance, exact counts и нескольких projection
owners.

**Checkpoint:** до DATA-02 определить manifest contract, регистрацию статичных
decoders/materializers, validation report и release pinning. Нельзя превращать
один parser в switch на тысячи строк или разрешать importer читать другой
source как fallback.

### `ARC-CHAR` — progression и authoritative resources

**Сейчас:** level/HP/MP/EXP и naked maxima находятся на `character.heroes`;
skills — в `hero_skills`; equipment totals вычисляются на чтении/мутации.

**Давление:** multi-level EXP, regeneration, death/injury и combat settlement
должны менять один согласованный character state.

**Решение CHR-01:** текущих границ достаточно; отдельный `ARC-CHAR` не нужен.
Character владеет idempotent EXP operation, hero row lock, managed naked skills
и persisted operation result. Catalog отдаёт один immutable progression
snapshot, inventory — read-only equipped modifier snapshot. Все character
writes выполняются в одной Unit of Work; active combat state и combat history
не участвуют. Optimistic `version` не заменяет row lock и persisted idempotency
key.

**Решение CHR-02:** текущих границ достаточно. Lazy HP regen живёт на том же
hero aggregate с `regen_at` и injected `Clock`. Combat отдаёт только
`isHeroInActiveFight`; character не пишет fight RAM и не читает combat tables.
`mp_time` не получает invented formula. Ghost/injury — CMB-04 character
колонки; regen пропускает ghost.

**Решение REP-01:** текущих границ достаточно; отдельный `ARC-CHAR` не нужен.
Catalog владеет authored track; character — `hero_reputations` и
`grantReputation`. SUM 36 считается на чтении. Контракт:
[REPUTATION.md](../modules/REPUTATION.md).

**Решение HERO-01:** текущих границ достаточно; отдельный `ARC-CHAR` не нужен.
`heroes.honor` уже на character aggregate. Catalog — `rank_table` /
`honorProgress`; combat — RAM human-applied damage snapshot; battleground —
match RAM sum + history; composition UoW вызывает `grantHonor`. Combat/BG
не пишут `heroes`. Контракт: [CHARACTER.md](../modules/CHARACTER.md),
[BATTLEGROUND.md](../modules/BATTLEGROUND.md).

Отдельный `ARC-CHAR` потребуется позже только если death/settlement/reputation
невозможно добавить без второго authoritative maxima, cross-module write из
character или циклической module dependency.

### `ARC-WORLD` — ownership местоположения

**Сейчас:** `area_id` физически хранится на `character.heroes`, хотя target
ownership принадлежит `world`.

**Давление:** travel, presence, instances и world facts требуют единого
location identity и guards.

**Решение WLD-01:** текущих границ достаточно; отдельный `ARC-WORLD` не нужен.
`heroes.area_id` остаётся persisted location за character port `setArea`.
World владеет authored `areas`/`area_links` (и `parent_id`). Travel lock —
`heroes.move_ready_at`. Character/wire не читают world tables. Отдельная
`character_locations` не создаётся.

Отдельный `ARC-WORLD` потребуется позже только если presence/instances нельзя
добавить без world-owned location projection, второго writer `area_id` или
циклической module dependency.

### `ARC-RTM` — realtime delivery и social

**Сейчас:** esrv MULTI несёт обязательный кадр `131:<area>` `common|hunt` и
личный `2:` (`fight|exit`, `chat|area_population_diff`). Полный roster —
OA `chat|area_population` из Postgres `sessions` ⨝ `heroes.area_id`. Delivery
queue process-local. Chat auth `{rc:"auth", eid:1}` → пустое HTTP body.
Long-poll wait per-account для esrv и fproxy; fproxy poll сначала отдаёт очередь, иначе ждёт, auth/strike будят waiter.

**Давление:** area presence, system chat, party, trade invitations и BG
используют разные legacy channels и lifetime.

**Решение RTM-01:** текущих границ достаточно; отдельный `ARC-RTM` не нужен.
Roster живёт в Postgres (`sessions` + `area_id`). Delivery queue и waiters —
process-local в `jugger-wire`. Durable outbox table не создаётся. Party/chat
не владеют Fastify. `4:` — `SOC-02`. **Решение SOC-01:** текущих границ
достаточно; отдельный `ARC-SOC`/`ARC-RTM` не нужен. Чат — `src/modules/chat`
без таблиц; fan-out process-local esrv; combat не импортирует chat. Контракт:
[CHAT.md](../modules/CHAT.md).

**Решение SOC-02:** текущих границ достаточно; отдельный `ARC-SOC` не нужен.
Party — `src/modules/party` / `party.parties` + members + invites. Membership
UoW с `FOR UPDATE`; esrv `4:<partyId>` через optional outbox channel. Combat
не импортирует party. Empty `party|bag` — wire chrome, bag engine SOC-03.
Контракт: [PARTY.md](../modules/PARTY.md).

**Решение SOC-03:** текущих границ достаточно; отдельный `ARC-SOC` не нужен.
`party_bag_items` в схеме `party`; TTL 3h. Inventory transfer — composition
UoW (`grantToBag` / `canFitBag`). Combat читает `FightLootRouting`, пишет bag
через `PartyBagDeposit`, party-таблицы не импортирует. `FIGHT_JOIN` /
`FIGHT_HELP` — hunt team 1, same-area, dump 204. Dungeon lottery / quest
personal_only / team 2 — leftover. Контракт: [PARTY.md](../modules/PARTY.md).

**Решение MAIL-01/MAIL-02:** текущих границ достаточно; отдельный `ARC-SOC`
не нужен. Mailbox — `src/modules/mail` / `mail.letters` + snapshot
`letter_attachments` (не JSONB, не live reservation). Postage/pick/COD —
composition UoW: character money + inventory take-by-instance. TTL sweep на
общем `DelayScheduler`. Chat piggyback не имитировать. Target `social`
mailbox остаётся планом. Контракт: [MAIL.md](../modules/MAIL.md).

Отдельный `ARC-RTM` потребуется позже только если доставка diffs должна
пережить restart процесса или social-модуль заберёт channel policy.

### `ARC-CMB` — terminal settlement

**Сейчас:** combat хранит active battle в RAM и best-effort finished history,
но не выполняет durable rewards.

**Давление:** один terminal outcome меняет character, inventory, quests,
economy, world lock и realtime notifications.

**Решение CMB-03:** текущих границ достаточно; отдельный `ARC-CMB` не нужен.
Combat отдаёт terminal snapshot; composition UoW вызывает character
`noteHp`/`grantExperience`/`creditMoney` и inventory bag/refill ports. Catalog
владеет authored `bots` reward scalars и `bot_loot_entries`. Durable writes
до esrv `fight|loot` затем `fight|exit`. History best-effort не откатывает
награду. Ghost/injury — CMB-04 character port из той же UoW. Active fight tables запрещены ADR-0020.

**Решение GEAR-01:** текущих границ достаточно; отдельный `ARC-CMB` не
нужен. Catalog владеет `extra.spell`; inventory — paperdoll instance;
composition снапшотит `gearSpells[]` на старт боя; combat держит RAM
kind-3 и не пишет `items`. ADR-0020 без active-fight tables.

Отдельный `ARC-CMB` потребуется позже только если settlement нельзя провести
без записи combat в чужие таблицы, durable outbox или active-fight rows.

### `ARC-ECO` — деньги и первый economy vertical

**Сейчас:** `money_minor` и `money_gold_minor` находятся на hero. Target
architecture относит wallets/ledger/store/auction к economy, которого ещё нет.

**Давление:** ECO-01 вводит покупку, затем mail COD, auction и trade требуют
reservations, ledger и race-safe settlement.

**Решение INV-02:** текущих границ достаточно; отдельный economy-модуль и
вторая сумма запрещены. Void-sell кредитует `heroes.money_minor` через
`creditMoney` в той же UoW, что и удаление предмета. Inventory не пишет
`heroes`.

**Решение ECO-01:** текущих границ достаточно; отдельный `ARC-ECO` не нужен.
Balance остаётся `heroes.money_minor`. Покупка — composition UoW:
character `debitMoney` + inventory `grantToBag`. Catalog владеет authored
`store_types` / `store_lots` (как `bot_loot_entries`), не модуль economy.
World уже владеет area 504 `code=store`. Dual-write hero↔economy wallet
запрещён. Контракт: [STORE.md](../modules/STORE.md).

**Решение ECO-02:** тех же границ достаточно. Витрина обобщена jsonb
`store_lots.pay` / `requires`; diamond — native `money_gold_minor` (1.00 =
100 minor), без 1:900 на buy; бартер списывает bag по catalog `artikul_id`,
не instance `items.id`. RANK читает `common_conf` honor tables. Come-in
LEVEL / `store_entries` не вводились. `src/modules/store-engine` нет.

**Решение INV-05:** текущих границ достаточно; отдельный `ARC-INV` /
`ARC-ECO` не нужен. Durability — inventory instance columns. Repair gold —
character `debitMoney` в composition UoW, как ECO-01. Death break —
inventory port из `HuntFightSettlement`, как pocket refill. Контракт:
[INVENTORY.md](../modules/INVENTORY.md).

**Решение AUC-01:** тех же границ достаточно. Модуль `auction` владеет
`auction.listings` со снимком предмета; ставка — колонки лота, не депозит.
Settlement — mail `deliverSystemInbox` + character `debitMoney` + inventory
take-by-instance в composition UoW. Dual-write hero↔economy wallet запрещён.
Контракт: [AUCTION.md](../modules/AUCTION.md).

**Решение AUC-02:** tenders на той же таблице (`kind=tender`). Hold заказа —
оставшийся `buyout_minor`, не депозит. Partial fill и гонка последнего cnt —
`FOR UPDATE` строки; settlement mail. `original_item_id=0` на заказе: instance
нет до fill.

**Решение TRD-01:** модуль `trade` держит process-local сессию (как hunt).
Tray id — ephemeral счётчик с 1, не PostgreSQL identity. Disconnect в том же
процессе держит сессию; restart процесса рвёт стол. Инвайт — esrv
`common|window`. Dual-write hero↔economy wallet запрещён.

**Решение TRD-02:** settle — composition UoW на двух героях: inventory
snapshot grant + character `debitMoney`/`creditMoney`. Налог dump
`0.25 × V^log₁₀(5)`, wire float / settle 2dp. Serial gate как dump.
`trade|confirm` system-чат — SOC-01 `ChatDesk.deliverSystem`, не фейк в trade.

Отдельный `ARC-ECO` потребуется позже только если понадобятся ledger,
reservation rows или persist сессии через restart.

### `ARC-QST` — quest definitions, progress и rewards

**Сейчас:** QST-ENG-01 runtime есть (authored graph + player progress/waiting);
bootstrap отдаёт книгу с синтетики. QST-ENG-02 не меняет владельцев.

**Давление:** immutable definitions, mutable cursor/goals/waiting, signals от
inventory/world/combat и multi-module rewards имеют разный lifetime.

**Решение QST-ENG-01 / QST-ENG-02:** текущих границ достаточно; отдельный
`ARC-QST` не нужен. Модуль `quests` владеет authored graph и player
progress/waiting. Награды и loot-cap — composition UoW через
character/inventory/reputation ports и quests-port `needed` (combat quests
не импортирует). Dialog и AREA `START_FIGHT` — CMB-09 после commit. JSONB
и DelayScheduler не вводятся. `ARC-QST` понадобится только если reward
нельзя провести без прямых cross-table writes. Контракт:
[QUESTS.md](../modules/QUESTS.md).

**Давление CONTENT-STORY-01:** q_1 требует JUMP_AREA, secondary board,
talk-npc, GRANT_AWARDS.rep, REMOVE equipped и quest roster — этого нет в
QST-ENG-02. Replan: `CMB-10` затем `QST-ENG-03`, не хардкод Акрилона.

**Решение CMB-10 / QST-ENG-03:** текущих границ достаточно; `ARC-QST` /
`ARC-CMB` / новый inventory-порт-модуль не нужны. Roster — тот же RAM
`FightDuel` (ADR-0020). QST-ENG-03 landed: `npc_quests.active_only` +
per-board welcome; talk signal несёт `npcId`; `JUMP_AREA` — wire leftover
на `npc|answer`, не `setArea`; `GRANT_AWARDS` зовёт `grantReputation`;
REMOVE — public `consumeByArtikul`. Контракт:
[COMBAT.md](../modules/COMBAT.md), [QUESTS.md](../modules/QUESTS.md).

**Replan после QST-ENG-04:** сюжет `CONTENT-STORY-*` не `next`. Сначала
leftover-механика: `OPEN_STORE` (QST-ENG-05), instance leftovers, persist
trade. CEF и DATA-mass — не эта очередь.

**Решение QST-ENG-04:** текущих границ достаточно; `ARC-QST` не нужен.
Landed raw-AMF: deny leave — CombatPort/fproxy; ambush `START_FIGHT` без
`mode:"quest"`, бой `purpose:"hunt"`; QL-2 — quests-port `syncOwned` после
bag mutation. `progress_on_win:false` и `OPEN_STORE` не этот срез.
Контракт: [QUESTS.md](../modules/QUESTS.md).

**Решение CMB-11:** текущих границ достаточно; `ARC-CMB` не нужен.
Landed: `joinHunt.team` = `1|2`; HELP = team цели; copy gate = RAM
`instanceCopyId` (`null` мир) со `startHunt`, сравнение на join.
Combat не импортирует instance/party. Один `FightDuel`: team-2 не берёт
бота; после смерти бота ретаргет team-1↔team-2. N×N две дуэли сразу —
leftover, не этот срез. Hunt EXP/лут только opener-team. Team 2 не врать
как «неактивный бой». ADR-0017–0020. Контракт: [COMBAT.md](../modules/COMBAT.md),
[PARTY.md](../modules/PARTY.md), [INSTANCE.md](../modules/INSTANCE.md).

**Решение DAY-01:** текущих границ достаточно; отдельный `ARC-QST` не нужен.
Daily cycle — lazy `Clock` на quests ports (UTC+3 / 06:00), не
`DelayScheduler` и не `Clock.schedule`. `hidden_in_journal` на том же
`hero_quests`. EXP idempotency для repeat-дня — cycle в `operationId`, не
второй ledger. Landed: `0023`, `playable-slice/v30`, `DailyCycleRules` /
`catchUpDailyCycle` / `hideFinishedDaily`. Контракт:
[QUESTS.md](../modules/QUESTS.md).

### `ARC-INS` — instances для dungeon и BG

**Сейчас:** area identity не различает полноценно world и instance copy;
instance module отсутствует.

**Давление:** dungeon binds/expiry и BG match lifecycle используют похожую
изоляцию, но разные правила membership, score и history.

**Решение DNG-01 / BG-01:** текущих ADR достаточно; отдельный ADR не нужен.
Модуль `instance` владеет copies, dungeon binds, expiry и killed-spawn
projection. BG не пишет `instance.binds`. World не хранит копии. Party не
хранит copy id как aggregate. Combat не импортирует instance/battleground;
`instance_id` на fight wire — ссылка. Dungeon и BG — разные policy на общем
copy identity (`copy_type`), не общая membership-таблица и не диапазон
`11_000_000`. Контракт: [INSTANCE.md](../modules/INSTANCE.md),
[BATTLEGROUND.md](../modules/BATTLEGROUND.md).

### `ARC-EDITOR` — operational authoring

**Сейчас:** EDT-01/02 operator HTTP пишет drafts/candidates, читает active
documents/keys и атомарно активирует pinned versions. File `seed`/`publish`
остаётся bootstrap (matching digest возвращает pointer на bootstrap).

**Давление:** SPA, rollback, named operators, новые ключи вне active
release, mass import DATA-02…06.

**Решение EDT-01:** текущих границ достаточно; отдельный `ARC-EDITOR` не
нужен. Landed: `0024`, `saveDraft`/`buildCandidate`/`validateCandidate`/
`activateCandidate`, `persistPinnedBundle`. File dual-write, SPA
`/dev/content`, SQLite, broker и content-service запрещены.

**Решение EDT-02:** текущих границ достаточно; отдельный `ARC-EDITOR` не
нужен. Landed: GET `readDocument`/`listKeys`, e2e six overlays,
`postgres-content-editor-read-store`. Новых таблиц и новых ключей нет.
Rollback/SPA leftover. Контракт: [CONTENT.md](../modules/CONTENT.md).

## Порядок безопасного refactor

Для принятого `ARC-*` coding plan обязан идти в таком порядке:

1. зафиксировать current и target contract тестами/документом;
2. добавить новый owner port и schema migration;
3. выполнить детерминированный backfill/import с проверкой counts/checksum;
4. переключить composition root и read models на новый owner;
5. удалить старый write/read path в той же завершённой миграции;
6. доказать отсутствие dual-write, fallback и runtime corpus access;
7. выполнить clean-DB, restart/concurrency и прежний CEF scenario.

Временный compatibility adapter допустим только внутри одного migration branch,
не активирует два источника истины и удаляется до merge. Для pre-baseline
разработки допустим документированный reset test DB, но production contract всё
равно должен иметь однозначного владельца.
