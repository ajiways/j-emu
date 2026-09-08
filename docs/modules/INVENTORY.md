# Inventory

## Статус

Paperdoll `PUT_ON`/`PUT_OFF`, bag DROP 9095 и pocket layout 93/99 **готово**:
raw-AMF E2E и реальный CEF-прогон. Точный статус:
[CAPABILITIES.md](../CAPABILITIES.md).

Не перенесены durability, fight cast/`persSpells`, world USE и патронташ.

## Источники поведения

- `jgr-emu/docs/INVENTORY_USE.md`;
- `jgr-emu/docs/TRAVEL_BAG.md`;
- `jgr-emu/docs/POCKET.md`;
- `jgr-emu/docs/GLOVE_MAGIC.md`;
- `jgr-emu/docs/ITEM_NPC_DIALOG.md`;
- `jgr-emu/src/items.ts`, `bagWeight.ts`, `bagSlots.ts`, `bonuses.ts`,
  `stats.ts`.

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
`actions` с `PUT_ON` (8) и `slot/slot2/slot_num=0`. Те же карточки несут
`DROP`/`SELL`, `sell_price`, `noweight`, `price` и catalog `flags`.
Пустой `artifact_actions` не создаёт USE. Отсутствующий catalog artifact
является ошибкой, а не поводом отдать неполную карточку.

## Mutations

Этот срез:

1. `PUT_ON` / `PUT_OFF` для paperdoll; клиент шлёт `common|action` или
   `common|object`, ответ всегда под `common|action`;
2. occupancy displaces the previous occupant of the same slot bit back to bag;
3. level / gender / non-paperdoll type → `status:203` + `error`;
4. missing hero/item/catalog → fail-fast `status:204` + `error`, не пустой `100`;
5. `DROP` / `SELL` из bag; throw-away 9095; deny equipped и SELL без
   `sell_price>0` → `status:204` + `error`;
6. pocket `PUT_ON`/`PUT_OFF` для 93/99: merge/split/swap, `listPocket`.

Следующий inventory capability — `INV-04` world USE мяса 77, не этот срез
до реализации; после него:

- durability/repair/upgrade;
- ADD_MP / DRINK / TEMPEFFECT и pocket fight cast (`CMB-02`);
- quest/item scripts и dialog actions — отдельный `IUS-01` после появления
  quest application ports.

Успешная equip mutation возвращает полный flat response: `common|action`,
`user|bag`, `user|view`, `user|pocket`, `user|skills`, `user|unitframe`,
`user|conf`, `state` и `sq`. Один пустой success block недостаточен. Equipped
wire `cnt` is `0`; instance quantity remains `1`.

Glove 9095 occupies paperdoll slot `32` from catalog `slot_mask`. Live starter
armor 20/26/103 is not invented in this playable slice.

## Fight boundary

Именованное `FightRules` (не live parity, не fallback). Пока
`CombatPort.activeFightId(accountId)` не `null`, layout-мутации инвентаря
запрещены: `PUT_ON`, `PUT_OFF`, `DROP`, `SELL`, world `USE` → **`status:203`** +
`error: "нельзя во время боя"`. Чтение bag/view/pocket/init не блокируется.

Смысл: в бою нельзя докладывать расходку на пояс и менять экип/сумку. Трата из
кармана — fproxy `castSpell` (`CMB-02`), не PUT_ON. World `USE` из bag live уже
`fightBusy`. Добор ячеек после боя (`POCKET.md` refill) — не этот срез.

Live `jgr-emu` `commonObject.ts` эти коды **не** блокирует; в
[FIGHT_LOCK.md](../../../jgr-emu/docs/FIGHT_LOCK.md) строка стоит как
«⬜ не блок (желательно позже)». j-emu закрывает эту дыру сознательно.

В бою `syncResources` по-прежнему не персистит regen clocks (CHR-02).

Pocket layout (INV-03) принадлежит inventory; active count/effects во время боя
— combat (`INV-04`/`CMB-02`). `persSpells.srcId` не должен столкнуться с
`items.id`. Packet ordering `rs`/strike задаётся [COMBAT.md](COMBAT.md). World
`user|magic` glove spells не входят в этот срез.

CEF 2026-09-08: новый герой, 93 и 99 на пояс, `status:100`, иконки приняты,
строки в PostgreSQL. Restart/reconnect покрыт raw-AMF e2e.

## Persistence

Каждая mutation:

- блокирует hero и item rows в одной PostgreSQL-транзакции;
- меняет inventory location и character vitals атомарно;
- DROP/void-sell удаляет или уменьшает стак; деньги пишет только character;
- не читает fixture JSON;
- подтверждается повторным bootstrap/view после reconnect.

Naked skills остаются в `hero_skills`. Totals и `hpMax`/`mpMax` считаются из
надетых `artifact_skills` на mutation и при чтении `user|skills`.

## INV-02 — bag rules and DROP

### Architecture decision

Отдельный `ARC-INV` не нужен. Inventory владеет экземплярами предметов;
character владеет `money_minor` на hero; catalog поставляет immutable
`priceMinor` / `flags` / `bagStack` из pinned release. Economy-модуля нет и
его нельзя изобретать: void-sell кредитует героя через public character port
в той же Unit of Work. `ARC-ECO` остаётся будущим checkpoint до ECO-01.

DROP не идемпотентен по `operation_id`: повтор клиента — вторая мутация.

### Wire

Клиент шлёт OA `common|object` (ответ под `common|action`). И UI «Продать», и
«Выкинуть» вызывают `UserBagDrop` → на wire **всегда** `code=DROP`. Кнопки
взаимоисключающие: `CAN_SELL && sell_price>0` → void-sell; иначе throw-away.

`SELL` live bag UI не шлёт. Alias зарегистрирован: та же мутация,
`{ action: "SELL" }`, строки ошибки «Продать». SELL без `sell_price>0`
(9095) — `204`, не throw-away: live UI этот код не отправляет.

Успешный DROP — **flat**, не набор PUT_ON:

- `common|action` = `{ action: "DROP" }` (для SELL — `"SELL"`);
- `user|bag`;
- `user|skills`;
- `user|mount_list` (пустой `mounts` допустим, блок обязателен);
- `state`.

Не включать `user|view` / `pocket` / `unitframe` / `conf`. Deny bag-правил —
**`status:204`** и поле `error` с точной русской строкой. Не «улучшать» bag-deny
до `203`. Активный бой — `FightRules`, не bag-правило: **`203`** +
`нельзя во время боя`.

| Исход                                               | `error`                                      |
| --------------------------------------------------- | -------------------------------------------- |
| DROP throw-away / missing / equipped / no FLAG_DROP | `Не удалось выполнить действие "Выбросить"!` |
| SELL OA / void-sell deny                            | `Не удалось выполнить действие "Продать"!`   |
| активный бой (`PUT_ON`/`PUT_OFF`/`DROP`/`SELL`)     | `нельзя во время боя`                        |

DROP **запрещён в бою** (`FightRules`). Вне боя DROP **разрешён при перегрузе**:
это способ снять overload; `amount > amount_max` DROP не блокирует. Equipped
(`location.kind !== "bag"`) DROP нельзя.

`in.amount` / `form.amount`: omitted / non-positive / non-finite → весь стак
(именованное правило, не catalog fallback). `take = min(floor(amount), have)`.

### Bag load

`user|bag.amount` — число bag-строк **без** `ARTIFACT_FLAG_NOWEIGHT` (`flags & 8`).
`total` — все bag-строки. `amount_max` — `GamePolicy.bagCapacity` (база **20**)
плюс сумма экипированного скилла `CAPACITY`. В текущем slice сумок нет → **20**.
Колонку `heroes.bag_capacity` не добавлять.

Поле каталога `weight:0` само по себе невесомость не значит. `noweight` на
wire = `flags & 8 ? 1 : 0`. Стартовая 9095: `flags: 40`
(NOWEIGHT\|NOGIVE) из live dump `_research/from_register/interesting_full.json`
(instance `flags: 40`, `price: 0`). После INV-02 init `amount` для одной 9095
становится **0**, `total` **1**.

20/20 ещё можно ходить; 21/20 нельзя — это **WLD-01** (`COME_IN` 204). INV-02
отдаёт query `{ amount, total, amountMax }` и сам travel не реализует.

### Catalog fields

Каждый опубликованный artifact обязан иметь:

- `priceMinor` — целое ≥ 0, центы золота; `0` валиден (unsellable);
- `flags` — целое ≥ 0;
- `bagStack` — целое ≥ 1.

Отсутствующее поле — ошибка candidate/runtime, не `?? 0` и не `bagStack || 9999`.
Unique paperdoll/bag: `bagStack = 1`, стакать нельзя. `priceMinor` missing ≠ 0.

9095: `priceMinor: 0`, `flags: 40`, `bagStack: 1`. Provenance: live dump
instance flags/price; unique wearable. Bundle сейчас `playable-slice/v8`
(INV-04 добавил 77; INV-03 добавил 93/99); миграция bag-полей —
`0007_catalog_artifact_bag_economy`, `artifact_actions` — `0009`.

Второго stackable/sellable артикула в slice нет. E2E/CEF — throw-away 9095.
Void-sell без dump-proven priced artifact не выдумывался.

### Sell price

Именованная формула, provenance `legacy behavior / empirical`
(`TRAVEL_BAG.md`, `items.ts` `sellPriceFromCatalog`):

`sellPriceMinor = priceMinor <= 0 ? 0 : min(4000, floor(priceMinor / 10))`

Wire `sell_price` и `price` — числа золота (`minor/100`), не строки. Void-sell,
если `(actions & FLAG_SELL) && sell_price > 0`; кредит
`sellPriceMinor * take` через `creditMoney` в той же UoW. `creditMoney(0)`
запрещён: DROP/SELL с `sell_price=0` только удаляют предмет. Overflow /
negative итога — fail-fast, не clamp.

`actions` в bag: `FLAG_DROP=1 | FLAG_SELL=2 | FLAG_PUT_ON=8` для paperdoll.
USE/GIVE/WAREHOUSE/upgrade в этом срезе не эмитить.

### Public ports

Inventory:

- `drop({ characterId, itemId, amount? })` — lock items, throw-away или
  сигнал void-sell (без записи `heroes`);
- `bagLoad({ characterId })` → `{ amount, total, amountMax }` для bag wire и
  будущего WLD-01.

Character, тот же UoW:

- `creditMoney({ characterId, minorUnits })` — положительное целое; lock hero;
  `money_minor + gain` в `[0, 2_147_483_647]`. Inventory repositories не пишут
  `heroes`.

OA DROP/SELL: lock hero + `syncResources` + `lockForHero` items, как PUT_ON.
Throw-away не вызывает `applyEquipmentVitals`. В бою `syncResources` не
персистит regen clocks (CHR-02).

### Persistence

- hero row lock + `lockForHero`;
- `take >= have` → delete item; иначе `withQuantity`;
- repository `delete` обязателен (сейчас есть только `create`/`save`);
- fixture JSON runtime не читает;
- reconnect/restart показывает тот же bag и `money`.

### Fail-fast

Не копировать legacy `cat?.price || 0` и missing-catalog fallback.
Нет предмета / чужой / не bag / нет catalog / нет FLAG → 204, не пустой 100.
Внутренняя ошибка (overflow, missing HPREG на sync) → 204 с логом, не 100.

### Out of scope

Pocket, USE, durability, mail GIVE, COME_IN overload, store buy, grant/merge
новых стаков (кроме уменьшения DROP), economy ledger.

### INV-02 acceptance

- unit: sell_price (0, tenth, cap 40 gold), noweight amount/total, amount
  coerce, flags, unique wearable не стакается;
- integration: concurrent DROP, rollback, void-sell только если появится
  dump-proven artifact, credit overflow;
- raw-AMF: DROP 9095 throw-away, empty bag `amount=0` `total=0`, money
  unchanged `"25.00"`, equipped DROP 204, SELL alias shape, reconnect;
  init/user|bag после публикации 9095: `amount=0`, `total=1`;
  DROP/SELL в активном hunt — `203` `нельзя во время боя`, bag без изменений;
- CEF: выкинуть перчатку из bag, деньги те же, bag пуст, reconnect —
  **подтверждено**;
- нет fake OA кроме реального DROP/SELL; нет ticker; нет travel gate.

## INV-03 — pocket layout

### Architecture decision

Отдельный `ARC-INV` не нужен. Пояс — те же `items` с `location_kind=pocket` и
`pocket_position` 1…capacity. Новых OA нет: клиент шлёт существующие
`PUT_ON`/`PUT_OFF`. Combat не читает pocket в этом срезе; порт `listPocket`
готовит CMB-02 без `persSpells` и без fight RAM.

Live стартовый пояс (93×2, 99×10, 209) **не копируем**. Slice выдаёт 93 и 99
в bag, pocket на login пустой — чтобы CEF проверял PUT_ON.

### Wire

`PUT_ON`: `in.slot_num` — ячейка 1…capacity; значение `67108864` (SLOT_EFFECT)
или omitted → auto (merge в неполный стак того же artikul, иначе первая
свободная). `in.slot` — только paperdoll, не пояс.

Успех — тот же flat набор, что paperdoll PUT_ON/OFF (`equipmentMutation`), но
`user|pocket.pocket` больше не пустой массив.

`user|pocket`: `{ status:100, capacity:4, pocket:[] }`. Элемент — массив, не
map. Dump `_research/from_register/interesting_full.json`: `slot=67108864`,
`slot_num` 1-based, `cnt` = quantity, `actions=16` (PUT_OFF), без
`action:"bag"`. Пустые ячейки в массив не входят; клиент рисует их по
`capacity`.

Deny пояса — **`204`** + `error` (live `putOn` pocket). Paperdoll WearDenied
остаётся **`203`**. Не смешивать.

| Исход                          | `error`                                      |
| ------------------------------ | -------------------------------------------- |
| нет свободной ячейки           | `Нет свободных ячеек в боевом инвентаре`     |
| не pocket-маска / 9095 на пояс | `Этот предмет нельзя надеть`                 |
| DROP не из bag                 | `Не удалось выполнить действие "Выбросить"!` |
| активный бой                   | `нельзя во время боя` (`203`)                |

PUT_ON/OFF **запрещены в бою** — тот же `FightRules` `203`, что DROP/SELL.
Трата из кармана в бою — `CMB-02`, не эта мутация.

### Правила слота

Pocketable: `(slot_mask & 67108864) !== 0` и paperdoll-биты 0…19 чисты.
93: `slot_mask=67108864`. 99: `slot_mask=603979776` (EFFECT + extra bit).

`pocketCntMax = max(1, floor(100 / weight))`. Provenance `ARCHITECTURE.md`.
93 `weight=100` → 1; 99 `weight=10` → 10. Weight обязателен и > 0; не копировать
legacy `weight || 100`.

Сценарии `putOnPocket`:

1. bag → пустой слот (split, если `cnt > pocketCntMax`);
2. bag → занятый тот же artikul → merge до max, остаток в bag;
3. bag → занятый другой artikul → displace старого в bag, положить новый;
4. pocket → pocket тот же artikul → merge;
5. pocket → pocket разные → SWAP.

PUT_OFF: `pocket → bag`, затем merge одинаковых bag-стаков до `bagStack`.
Патронташ / orb-only слот / `SLOT_CNT` — не в срезе. `capacity` = policy **4**.

### Content

`playable-slice/v6` → **v7**. Миграция `0008_inventory_pocket_position_unique`.

| id  | title                 | picture                  | typeId | kindId | slotMask  | weight | priceMinor | flags | bagStack |
| --- | --------------------- | ------------------------ | ------ | ------ | --------- | ------ | ---------- | ----- | -------- |
| 93  | Малый эликсир жизни   | `bottles_live1_2712.png` | `"7"`  | 154    | 67108864  | 100    | 100        | 0     | 99       |
| 99  | Малый усиливающий орб | `bottles_sila1.png`      | `"7"`  | 152    | 603979776 | 10     | 15         | 0     | 999      |

Dump: `interesting_full.json` `user|pocket` (price 1.0 / 0.15, flags 0, empty
skills). Weight/bagStack: `ARCHITECTURE.md` примеры. `levelMin=1`, `levelMax=0`,
`skills=[]`. Spell/`artifact_actions` не публиковать — INV-04.

Starter: 9095×1 bag, 93×2 bag, 99×10 bag. Не выдавать 209, броню 20/26/103,
сундук 1518.

### Public ports

- расширить `putOn` (или соседний `putOnPocket`) опциональным `pocketPosition`;
- `putOff` уже существующий — уметь pocket→bag;
- `listPocket({ characterId })` — ordered snapshot для wire и будущего CMB-02.

OA: decode `slot_num` на существующем `PutOnCommand`. Новых `requiredKeys` нет.

Lock: hero + `lockForHero` + `syncResources`, как PUT_ON. Не
`applyEquipmentVitals` для пояса (нет `artifact_skills`).

### Out of scope

Fight `castSpell` / `persSpells` / `rs` ordering, refill after fight, USE из
bag, медальон 209, патронташ, TEMPEFFECT drinks, durability.

### INV-03 acceptance

- unit: `isLeftPocket` (EFFECT set, paperdoll clear), `pocketCntMax`
  (`floor(100/weight)` → 93→1, 99→10), amount coerce/split, swap vs merge;
- integration: unique pocket_position, concurrent PUT_ON same slot, rollback,
  bag merge on PUT_OFF;
- raw-AMF: init empty pocket `capacity=4`; PUT_ON 93 → `slot_num` 1,
  `slot=67108864`, `cnt=1`, `actions=16`; leftover bag stack; PUT_OFF back;
  merge/split 99; swap 93↔99; 9095 into pocket `204`; DROP from pocket `204`;
  PUT_ON/OFF в активном hunt — `203` `нельзя во время боя`; reconnect;
- CEF: перетащить эликсир 93 на пояс, reconnect, снять в bag; без каста в бою
  — **подтверждено** (в прогоне надели оба 93 и 99; leftover/restart — e2e);
- нет fake OA; нет spell blob; нет 209/патронташа.

## INV-04 — world USE (ADD_HP meat)

### Architecture decision

Отдельный `ARC-INV` не нужен. World USE — bag-only OA на существующих
`common|object` / `common|action`. Клиент (`UseArtifact.as`) шлёт
`object_class: "ARTIFACT"`, `object_id` = `items.id`, часто **без** `code`.
Сервер берёт **первую** запись каталожного `artifact_actions`. Текст описания
не парсить.

Трата из кармана в бою — fproxy (`CMB-02`), не этот OA. Quest `bonus_id`
pipelines / `openDialog` — `IUS-01`. LEARN_RECIPE — профессии. DRINK /
TEMPEFFECT / ADD_MP — нет dump-proven L1 артикула в slice; неизвестный `code`
→ `203`, не выдумывать хлеб/ману.

### Wire

Реестр: не `common|object:undefined`. Если `object_class=ARTIFACT` и `code`
пустой — ключ **`common|object:USE`**. `FightRules`: активный бой → **`203`**
`нельзя во время боя` (live `fightBusy` на USE).

Успех — **flat**, `common|action` = `{ action: "USE" }` без `msg_text` для
мяса 77 (live ADD_HP meat не ставит plaque):

- `common|action`;
- `user|bag`;
- `user|pocket`;
- `user|unitframe`;
- `user|skills`;
- `state`.

`user|view` только если mutation грязнит view (DRINK — не этот срез). Deny —
**`203`** + `error` (live `notPossible`), не bag-`204`.

| Исход                       | `error`                                 |
| --------------------------- | --------------------------------------- |
| активный бой                | `нельзя во время боя`                   |
| нет / чужой предмет         | `предмет не найден`                     |
| не bag (pocket / paperdoll) | `снимите предмет чтобы использовать`    |
| нет `artifact_actions`      | `у предмета нет действия использования` |
| неизвестный `code`          | `действие «CODE» пока не поддержано`    |
| ADD_HP gain ≤ 0             | `некорректный эффект`                   |

Полный HP USE **не** deny: consume всё равно, HP не меняется.

### Правила ADD_HP

`gain = param2=="0" ? max(1, floor(hpMax * param1 / 100)) : param1`.
Provenance `artifactUse.ts` `amountFromParams`. `param1` обязателен и > 0;
не `Number(param1) || 0` как маскировка missing. Затем
`hp' = min(hpMax, hp + gain)`. Сначала `syncResources` (CHR-02), потом consume

- `noteHp` в той же UoW. `dispose=1`: `cnt<=1` удаляет строку, иначе `cnt-1`.
  `cnt=0` unique (сундук 1518) — не в срезе.

### Content

`playable-slice/v7` → **v8**. Каталог: обязательный typed `artifact_actions`
(пустой объект валиден = нет USE). 9095/93/99 остаются `{}`.

| id  | title      | picture            | typeId | kindId | slotMask | weight | priceMinor | flags | bagStack |
| --- | ---------- | ------------------ | ------ | ------ | -------- | ------ | ---------- | ----- | -------- |
| 77  | Кусок мяса | `rawmeat_grey.png` | `"10"` | 48     | 0        | 0      | 3          | 40    | 99       |

Dump instance: `flags: 40`, `price: 0.03`, `actions: 7`, `noweight: 1`,
`artifact_actions["20"].code=ADD_HP`, `param1=30`, `param2=0`, `dispose=1`,
`title` «Съесть мясо». `level_min=0`; `level_max` live-сентинел `536870911`
**не копировать** → `0`. `bagStack=99`: dump доказывает stack (`cnt=4`); 99 —
именованный food-stack, не `9999`. Wire `artifact_actions` — **map**, не
array; ключ `"20"` как в dump.

Bag `actions` = `FLAG_DROP\|FLAG_SELL\|FLAG_USE` = **7**, без PUT_ON.
Starter: 9095×1, 93×2, 99×10, **77×4** bag.

### Public ports

- `useFromBag({ characterId, itemId })` — lock items, consume по `dispose`;
- catalog `artifact(id).useAction` — первая typed action или отсутствует;
- character: `syncResources` + `noteHp` на locked hero в OA UoW.

OA: новый `UseArtifactCommand`, не ветка внутри PUT_ON. Новых URL нет.

### Out of scope

ADD_MP, DRINK/TEMPEFFECT, books/`bonus_id`, waiting, openDialog, recipes,
ghost, pocket cast, refill after fight, durability.

### INV-04 acceptance

- unit: percent/abs ADD_HP, missing param fail-fast, actions=7 vs empty `{}`;
- integration: consume last charge deletes row; concurrent USE one winner;
  rollback leaves HP and cnt;
- raw-AMF: wounded USE 77 → HP +gain, cnt−1, flat USE; full HP consumes;
  fight `203`; 9095/93/99 `203`; reconnect;
- CEF: съесть мясо из bag, стак падает; без каста в бою;
- нет fake OA; нет хлеба/маны/DRINK.

### CEF observation — 2026-09-08

Новый CEF-герой (`POST /register` → `accountId` 2). Init `status:100` с
`user|bag`. Четыре `common|object:USE` (sq 20, 21, 23, 24) — все
`status:100`, `outcome:ok`. Flat: `common|action`, `user|bag`, `user|pocket`,
`user|skills`, `user|unitframe`, `state`. Нет `user|view`. Инвентарных
`203`/`204` на этом пути нет.

Postgres после сессии: 77 нет (стак съеден целиком, 4 заряда). 9095 paperdoll;
93×1+93×1 и 99×10 на поясе. HP 15/15 (перчатка надета). Картинка
`rawmeat_grey.png` на wire; HUD не падал. Каста в бою не было.

Побочное: `assistant|info` 203 unsupported. Не inventory.

Product «готово» — за architecture close (ROADMAP `next`).

## Architecture checkpoint — план

Containers, reservations и durability schema по-прежнему не спроектированы.
Следующий inventory checkpoint после INV-04 — quest-aware `IUS-01`; DRINK /
ADD_MP — отдельный срез, когда появится dump-proven артикул.
Процесс: [ROADMAP.md](../migration/ROADMAP.md) и
[PLAYBOOK.md](../migration/PLAYBOOK.md).

## Acceptance

- UI и PostgreSQL совпадают после каждой mutation;
- повтор/гонка не дублирует, не теряет и не создаёт item;
- item IDs остаются стабильными после restart;
- malformed/missing catalog data дают explicit error;
- raw-AMF response сохраняет legacy flat shape;
- paperdoll 9095 **готово** подтверждён CEF PUT_ON (статы и bag);
- DROP throw-away 9095 **готово** подтверждён CEF из bag;
- pocket 93/99 **готово** подтверждён CEF PUT_ON на пояс.
