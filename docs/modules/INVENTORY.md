# Inventory

## Статус

Перенесены catalog projection, stable item IDs, starter items и чтение bag.
Inventory mutations и USE pipelines ещё не перенесены.

## Источники поведения

- `jgr-emu/docs/INVENTORY_USE.md`;
- `jgr-emu/docs/TRAVEL_BAG.md`;
- `jgr-emu/docs/POCKET.md`;
- `jgr-emu/docs/GLOVE_MAGIC.md`;
- `jgr-emu/docs/ITEM_NPC_DIALOG.md`;
- `jgr-emu/src/items.ts`, `bagSlots.ts`, `bonuses.ts`, `stats.ts`.

## Модель

Catalog artifact и item instance — разные сущности:

- authored `artikul_id` сохраняется из content;
- runtime `items.id` выдаёт PostgreSQL sequence с `100_000`;
- instance хранит quantity, location, slots, durability и прочий mutable state;
- presentation, type/kind, actions и базовые ограничения приходят из catalog
  active release.

Bag item обязан иметь подтверждённые `type_id`, `kind_id`, `picture` и
`action:"bag"`. Пустой `artifact_actions` не создаёт USE. Отсутствующий catalog
artifact является ошибкой, а не поводом отдать неполную карточку.

## Mutations

Core переносится в таком порядке:

1. PUT_ON/PUT_OFF для paperdoll;
2. pocket merge/split/swap;
3. DROP/void-sell;
4. stack limits и bag capacity;
5. stat/body recalculation;
6. USE food/HP/MP и необходимые quest/item pipelines;
7. durability/repair/upgrade только при наличии core dependency.

Успешная equip mutation возвращает полный flat response с согласованными bag,
view, pocket, skills, state и `sq`. Один пустой success block недостаточен.

DROP сохраняет wire code `DROP`. Sellable/void behavior переносится по legacy
правилам; сервер не заменяет запрещённый sell молчаливым discard.

## Fight boundary

Pocket/glove definitions принадлежат inventory/catalog, а active count/effects
во время боя — combat. `persSpells.srcId` не должен столкнуться с `items.id`.
Packet ordering `rs`/strike задаётся [COMBAT.md](COMBAT.md).

## Persistence

Каждая mutation:

- блокирует или version-checks затронутые instances;
- меняет inventory и character-derived state атомарно;
- не читает fixture JSON;
- подтверждается повторным bootstrap после reconnect.

## Acceptance

- UI и PostgreSQL совпадают после каждой mutation;
- повтор/гонка не дублирует, не теряет и не создаёт item;
- item IDs остаются стабильными после restart;
- malformed/missing catalog data дают explicit error;
- raw-AMF response сохраняет legacy flat shape.
