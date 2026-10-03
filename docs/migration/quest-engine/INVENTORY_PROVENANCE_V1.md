# Quest engine: inventory provenance and asset ledger v1

> **Статус:** обязательная enabling capability для QE-05. Текущий inventory
> объединяет одинаковые stacks и `grantToBag()` возвращает `void`, поэтому он не
> может доказать, какие единицы принадлежат конкретному quest run.

## Разделение ответственности

- Inventory владеет физическими item instances/stacks, quantity, location,
  split/merge/consume/transfer и capacity.
- Quest engine владеет намерением: какой asset выдан, временный ли он, как
  восстанавливается и должен ли очищаться при cancel.
- Связь — immutable inventory provenance lots и quest asset ledger.

Quest engine не удаляет строки inventory напрямую и не ищет «все artifact X».

## Почему одного `item_id` недостаточно

Stack может содержать 10 одинаковых предметов: 4 куплены, 3 выданы квестом A,
3 — квестом B. После частичного consume/drop/split необходимо знать, какие lots
ушли. Запрет merge только для одного quest случая быстро расползётся по всем
inventory operations. Целевая модель хранит provenance количества отдельно от
wire-visible stack.

## Inventory provenance lot

Новая owned inventory table:

```text
inventory.item_lots
  id bigint identity PK
  inventory_item_id FK
  quantity integer > 0
  origin_kind text
  origin_operation_id text
  owner_scope text
  owner_key text nullable
  generation integer nullable
  transfer_policy text
  created_at
```

Инвариант под item lock:

```text
inventory_items.quantity = SUM(item_lots.quantity)
```

Для старого/обычного grant создаётся lot `origin_kind=system|loot|purchase|craft`
без quest owner. Quest grant использует `owner_scope=quest_asset`, owner key
`runId/assetKey`, generation.

Lots не передаются клиенту и не меняют wire stack id. Merge может переместить
lots к surviving stack; split делит quantities между новыми rows, не теряя
origin.

## Stack compatibility

Два inventory rows можно merge, только если совпадают все wire/gameplay свойства:

- hero/location/artifact;
- durability/upgrade/instance data;
- expiry/tempeffect semantics;
- binding/transfer policy.

Provenance может различаться: lots сохраняют различие внутри merged stack.
Если artifact mechanics требуют уникальный instance, catalog stack size остаётся 1.

## Quest inventory port

```ts
interface QuestInventoryPort {
  snapshot(heroId: number, selectors: readonly ItemSelector[]): Promise<InventorySelectionSnapshot>;
  grant(input: QuestGrantInput): Promise<QuestGrantResult>;
  consume(input: QuestConsumeInput): Promise<QuestConsumeResult>;
  transform(input: QuestTransformInput): Promise<QuestTransformResult>;
  cleanup(input: QuestCleanupInput): Promise<QuestCleanupResult>;
  reserve(input: QuestReserveInput): Promise<QuestReservation>;
  releaseReservation(reservationId: string): Promise<void>;
}
```

Port вызывается внутри общей UoW и предполагает уже захваченный hero lock. Он
сам блокирует inventory rows/lots в ascending id.

## Grant

```ts
type QuestGrantInput = Readonly<{
  operationKey: string;
  heroId: number;
  itemId: number;
  quantity: number;
  owner?: { runId: string; assetKey: SemanticKey; generation: number };
  ownership: "temporary" | "permanent";
  expiresAt?: Date;
  transfer: "hero_bound" | "normal";
  capacity: "overflow" | "require_space";
}>;

type QuestGrantResult = Readonly<{
  operationKey: string;
  lots: readonly ItemLotMutation[];
  granted: number;
}>;
```

Обычная quest reward использует `overflow`; bag load может превысить normal
capacity, но существующие items не выпадают и grant не отказывается. Временный
quest asset обычно `hero_bound`; authored permanent reward — `normal`, если
catalog не требует binding.

Тот же `operationKey` возвращает сохранённый result без нового quantity.

## Select и consume

Selector разрешается под locks. Allocation deterministic:

1. exact quest owner/generation, если задан;
2. earliest expiry first;
3. stack id;
4. lot id.

```ts
type QuestConsumeInput = Readonly<{
  operationKey: string;
  heroId: number;
  selector: ItemSelector;
  quantity: number;
  mode: "consume" | "require_only";
}>;
```

Result перечисляет каждый затронутый lot/stack и before/after quantity. Нехватка
одной единицы откатывает всё. `require_only` не мутирует state, но его snapshot
нельзя использовать после освобождения locks для последующего consume.

## Reserve

Reserve нужен для wait/interaction, когда consume должен произойти позже.

- reservation привязана к hero/operation/selector/quantity;
- reserved lots нельзя drop/sell/trade/use другой операцией;
- quantity физически остаётся в inventory до commit/cancel;
- expiry может победить reservation только по явно заданной policy;
- reservation имеет persisted state и lease/owner generation, не RAM mutex.

Для простого `consume_on_start` reservation не нужна. Для
`consume_on_success` после долгого wait — обязательна либо предмет может исчезнуть
между start/finish.

## Transform

Transform одной UoW:

1. lock/resolve все inputs;
2. проверить table/location/profession/effect guards;
3. consume/reserve/require-only inputs;
4. создать output lots с provenance transformation operation;
5. записать operation result;
6. вернуть typed domain facts.

Никакой output не создаётся при частичном input failure. Retry operation key не
создаёт output повторно.

## Quest asset ledger

`quests.asset_grants` ссылается не на один stack, а на origin operation/owner:

```text
id bigint identity
run_id
asset_key
generation
grant_operation_key unique
item_id
granted_quantity
ownership temporary|permanent
state active|partially_consumed|consumed|lost|expired|cleaned
recovery_policy jsonb
expires_at nullable
```

Фактический remaining вычисляется по inventory lots owner key либо поддерживается
ledger projection с reconciliation check. Inventory остаётся источником истины
о quantity; ledger — источник ownership/recovery policy.

## Drop, sell, trade и use

Каждая inventory operation возвращает lot mutations/domain fact. Политики:

- `hero_bound` запрещает sell/trade/mail/party bag;
- drop может быть запрещён catalog/binding либо разрешён и помечает asset lost;
- use выбирает конкретные lots до script/effect;
- generic consume не может случайно взять reserved lot;
- cleanup удаляет только temporary lots конкретного owner/generation.

Если authored recovery разрешает выбросить предмет, quest event router получает
`items_removed(reason=drop)` и применяет `deny/reissue/reset/branch/cancel`.

## Expiry

Item expiry и quest recovery разделены:

1. inventory worker/command catch-up атомарно удаляет expired rows/lots;
2. пишет durable `inventory.items_removed(reason=expiry)` fact;
3. quest engine применяет recovery по asset ledger generation;
4. duplicate expiry fact безопасен receipt-ом.

Quest engine не считает отсутствие item достаточным доказательством expiry.

## Cancellation cleanup

Под hero/run/inventory locks:

- выбрать active temporary ledger generations;
- удалить remaining lots exact owner keys;
- сохранить lot mutations + cleanup receipt;
- permanent/reward lots не трогать;
- закрыть reservations;
- terminal history и cleanup commit-ятся вместе.

Если часть temporary quantity уже consumed/lost, cleanup не пытается удалить
обычные предметы того же artifact id.

## Migration current inventory

При добавлении lots для каждой существующей stack row создаётся один baseline
lot с её полной quantity и `origin_kind=legacy_baseline`. Это data migration
inventory, не migration старых quests.

После backfill добавляется deferred/transaction validation равенства quantities.
Все write paths переводятся на item+lot mutation до включения constraint.

## Tests

- merge/split сохраняет lot sums/provenance;
- quest и обычные quantities в одном stack;
- deterministic partial consume;
- duplicate grant/consume/transform;
- cancel удаляет только временный owner;
- drop/reissue generation race;
- expiry против use/reservation;
- reward overflow;
- concurrent sell/consume/cancel;
- rollback не оставляет orphan lots/ledger;
- transfer policy на trade/mail/party bag;
- reconciliation обнаруживает quantity mismatch fail-fast.
