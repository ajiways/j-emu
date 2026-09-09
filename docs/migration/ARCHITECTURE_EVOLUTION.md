# Архитектурная эволюция переноса

Этот документ перечисляет известные точки, где следующая capability может
потребовать изменения общей архитектуры. Он не задаёт будущие private classes
или таблицы и не разрешает refactor заранее.

Текущий проверенный checkpoint — готовые bootstrap, paperdoll PUT_ON/PUT_OFF,
internal CHR-01 `grantExperience`, internal CHR-02 `syncResources`/`noteHp` и
INV-02 bag DROP/`creditMoney`, INV-03 pocket layout 93/99, INV-04 world USE
77 ADD_HP, WLD-01 area transitions 503↔501/504 и RTM-01 presence roster:
persistent state находится в PostgreSQL; esrv delivery и hunt overlay (WLD-02)
— process-local; active content через release projections; active combat в RAM.
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
`mp_time` не получает invented formula. Ghost/injury по-прежнему `CMB-04`.

Отдельный `ARC-CHAR` потребуется позже только если death/settlement невозможно
добавить без второго authoritative maxima, cross-module write из character
или циклической module dependency.

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
Long-poll wait per-account; fproxy wait остаётся unscoped.

**Давление:** area presence, system chat, party, trade invitations и BG
используют разные legacy channels и lifetime.

**Решение RTM-01:** текущих границ достаточно; отдельный `ARC-RTM` не нужен.
Roster живёт в Postgres (`sessions` + `area_id`). Delivery queue и waiters —
process-local в `jugger-wire`. Durable outbox table не создаётся. Party/chat
не владеют Fastify. `4:` и `chat|add` остаются post-core.

Отдельный `ARC-RTM` потребуется позже только если доставка diffs должна
пережить restart процесса или social-модуль заберёт channel policy.

### `ARC-CMB` — terminal settlement

**Сейчас:** combat хранит active battle в RAM и best-effort finished history,
но не выполняет durable rewards.

**Давление:** один terminal outcome меняет character, inventory, quests,
economy, world lock и realtime notifications.

**Checkpoint:** CMB-03 определяет idempotent terminal result и application
orchestrator. Combat не пишет чужие таблицы. Durable state фиксируется до
post-commit packets; ошибка history не меняет reward outcome. Active fight
tables запрещены ADR-0020.

### `ARC-ECO` — деньги и первый economy vertical

**Сейчас:** `money_minor` и `money_gold_minor` находятся на hero. Target
architecture относит wallets/ledger/store/auction к economy, которого ещё нет.

**Давление:** ECO-01 вводит покупку, затем mail COD, auction и trade требуют
reservations, ledger и race-safe settlement.

**Решение INV-02:** текущих границ достаточно; отдельный economy-модуль и
вторая сумма запрещены. Void-sell кредитует `heroes.money_minor` через
`creditMoney` в той же UoW, что и удаление предмета. Inventory не пишет
`heroes`.

**Checkpoint:** до ECO-01 выбрать долгоживущего владельца balance. Нельзя
сначала создать вторую сумму в economy и синхронизировать её с hero dual-write.
Если ownership переносится, `ARC-ECO` описывает schema migration, public balance
port, bootstrap read model и атомарный переход.

### `ARC-QST` — quest definitions, progress и rewards

**Сейчас:** quest runtime/projections отсутствуют; bootstrap отдаёт пустой book.

**Давление:** immutable definitions, mutable cursor/goals/waiting, signals от
inventory/world/combat и multi-module rewards имеют разный lifetime.

**Checkpoint:** QST-01/02 разделяют authored definitions и player progress,
задают typed `QuestSignal`, script registry и idempotency. `ARC-QST` обязателен,
если reward нельзя провести через одну orchestration transaction/public ports
без прямых cross-table writes.

### `ARC-INS` — instances для dungeon и BG

**Сейчас:** area identity не различает полноценно world и instance copy;
instance module отсутствует.

**Давление:** dungeon binds/expiry и BG match lifecycle используют похожую
изоляцию, но разные правила membership, score и history.

**Checkpoint:** перед DNG-01 определить общий instance identity/lifecycle и
границу dungeon/BG policies. Нельзя объединять dungeon и BG domain только ради
повторного использования таблиц.

### `ARC-EDITOR` — operational authoring

**Сейчас:** publication принимает import bundle; editor в `j-emu` отсутствует.

**Давление:** concurrent drafts, validation reports, activation permissions и
rollback становятся пользовательскими операциями.

**Checkpoint:** EDT-01 использует существующие content application ports.
Editor не пишет runtime projections и files напрямую. Новый content service,
broker или object storage допускается только после измеренной необходимости и
отдельного ADR.

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
