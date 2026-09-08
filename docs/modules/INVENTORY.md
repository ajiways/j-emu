# Inventory

## Статус

Paperdoll `PUT_ON`/`PUT_OFF` для перчатки 9095 **готово**: raw-AMF E2E и
реальный CEF-прогон (экип, статы, пересчёт места в bag). Точный статус:
[CAPABILITIES.md](../CAPABILITIES.md).

Не перенесены DROP/void-sell, stack/capacity, durability/repair, pocket
merge/split/swap и USE pipelines.

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
- instance хранит quantity, location, slots и прочий mutable state;
- presentation, type/kind, wear limits и `artifact_skills` приходят из catalog
  active release.

Bag item обязан иметь подтверждённые `type_id`, `kind_id`, `picture` и
`action:"bag"`. Карточка 9095 использует live-имя `greyset5_lhand.png` и
`artifact_skills` с title из skill catalog. Wearable paperdoll в bag имеет
`actions` с `PUT_ON` (8) и `slot/slot2/slot_num=0`. Пустой `artifact_actions`
не создаёт USE. Отсутствующий catalog artifact является ошибкой, а не поводом
отдать неполную карточку.

## Mutations

Этот срез:

1. `PUT_ON` / `PUT_OFF` для paperdoll; клиент шлёт `common|action` или
   `common|object`, ответ всегда под `common|action`;
2. occupancy displaces the previous occupant of the same slot bit back to bag;
3. level / gender / non-paperdoll type → `status:203` + `error`;
4. missing hero/item/catalog → fail-fast `status:204` + `error`, не пустой `100`.

Следующий inventory capability, не этот срез:

- pocket merge/split/swap;
- DROP/void-sell;
- stack limits и bag capacity;
- durability/repair/upgrade;
- USE food/HP/MP и quest/item pipelines.

Успешная equip mutation возвращает полный flat response: `common|action`,
`user|bag`, `user|view`, `user|pocket`, `user|skills`, `user|unitframe`,
`user|conf`, `state` и `sq`. Один пустой success block недостаточен. Equipped
wire `cnt` is `0`; instance quantity remains `1`.

Glove 9095 occupies paperdoll slot `32` from catalog `slot_mask`. Live starter
armor 20/26/103 is not invented in this playable slice.

## Fight boundary

Pocket/glove definitions принадлежат inventory/catalog, а active count/effects
во время боя — combat. `persSpells.srcId` не должен столкнуться с `items.id`.
Packet ordering `rs`/strike задаётся [COMBAT.md](COMBAT.md). World `user|magic`
glove spells не входят в этот срез.

## Persistence

Каждая mutation:

- блокирует hero и item rows в одной PostgreSQL-транзакции;
- меняет inventory location и character vitals атомарно;
- не читает fixture JSON;
- подтверждается повторным bootstrap/view после reconnect.

Naked skills остаются в `hero_skills`. Totals и `hpMax`/`mpMax` считаются из
надетых `artifact_skills` на mutation и при чтении `user|skills`.

## Acceptance

- UI и PostgreSQL совпадают после каждой mutation;
- повтор/гонка не дублирует, не теряет и не создаёт item;
- item IDs остаются стабильными после restart;
- malformed/missing catalog data дают explicit error;
- raw-AMF response сохраняет legacy flat shape;
- paperdoll 9095 **готово** подтверждён CEF PUT_ON (статы и bag).
