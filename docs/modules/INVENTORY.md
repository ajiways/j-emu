# Inventory

## Статус

Paperdoll `PUT_ON`/`PUT_OFF`, bag DROP 9095, pocket 93/99 и world USE 77
**готово**: raw-AMF E2E и реальный CEF-прогон. Durability/repair (INV-05)
и upgrade (INV-06) — workflow `done`, product **частично** без CEF
мастерской и диалога заточки. Точный статус:
[CAPABILITIES.md](../CAPABILITIES.md).

Не перенесены fight cast/`persSpells` и патронташ. DRINK/ADD_MP/bonus USE —
INV-08: workflow `done`, product **частично** без CEF Flash. Operator HTTP
выдачи в bag — [CHARACTER.md](CHARACTER.md) EDT-03.

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
6. pocket `PUT_ON`/`PUT_OFF` для 93/99: merge/split/swap, `listPocket`;
7. world USE из bag по `artifact_actions` (`ADD_HP` 77, `DRINK` 640,
   empty-code bonus 623, consume/grant 2371, `NPC` 584 → 203).

Дальше не этот срез:

- quest NPC dialog (`openDialog`) и remaining bonus kinds — QST-ENG / SOC-01;
- waiting/openBoard/bumpGoal/LEARN_RECIPE.

Успешная equip mutation возвращает полный flat response: `common|action`,
`user|bag`, `user|view`, `user|pocket`, `user|skills`, `user|unitframe`,
`user|conf`, `state` и `sq`. Один пустой success block недостаточен. Equipped
wire `cnt` is `0`; instance quantity remains `1`.

Paperdoll `PUT_ON`/`PUT_OFF` пересобирает `heroes.body` из `artikuls.f_body`
надетых equipment+tempeffect (карман не входит) и отдаёт строку в
`user|view.body` и в `fight|conf.persSelf_body` / `persSelf_sk` на старте боя
(старый `buildFightConf` берёт `hero.body` / `hero.sk`, не stub). Это
Unity-оверлей `armor(<tokens>);head(...);skin()`, не иконки paperdoll. Пустой
`f_body` (кольца) на модель не влияет; отсутствие каталожной записи — ошибка,
не голый `armor()`. Head/skin берутся из текущего body героя.

Glove 9095 occupies paperdoll slot `32` from catalog `slot_mask`. Live starter
armor 20/26/103 is not invented in this playable slice.

## Fight boundary

Именованное `FightRules` (не live parity, не fallback). Пока
`CombatPort.activeFightId(accountId)` не `null`, layout-мутации инвентаря
запрещены: `PUT_ON`, `PUT_OFF`, `DROP`, `SELL`, world `USE`, `UPGRADE` → **`status:203`** +
`error: "нельзя во время боя"`. Чтение bag/view/pocket/init не блокируется.

Смысл: в бою нельзя докладывать расходку на пояс и менять экип/сумку. Трата из
кармана — fproxy `castSpell` (`CMB-02`), не PUT_ON. World `USE` из bag live уже
`fightBusy`. Добор ячеек после боя (`POCKET.md` refill) — `CMB-03`: spent cells
добираются из bag до `pocketCntMax`; исчезнувший стак создаётся в том же
`slot_num`.

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
в той же Unit of Work. ECO-01/ECO-02 не создают economy-модуль; `debitMoney`,
`debitMoneyGold` и витрина — [STORE.md](STORE.md). Бартер списывает bag по
catalog `artikul_id` (`countBagByArtifact` / `consumeFromBag`), не по
instance `items.id`. Аукцион AUC-01/AUC-02 — модуль `auction` + тот же
take-by-instance на fill заказа; `ARC-ECO` нужен только для ledger/trade.

DROP не идемпотентен по `operation_id`: повтор клиента — вторая мутация.
QL-2: после успешного DROP/SELL, USE consume и script `REMOVE_ARTIKUL`
composition синхронизирует текущие loot/deliver цели через quests-port
`syncOwned`; inventory quests не импортирует.

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
- `bagStack` — целое ≥ 1;
- `fBody` — строка Unity-оверлея; `""` валиден (нет визуала). Pub1 опускает
  `f_body`, когда токена нет.

Отсутствующее поле — ошибка candidate/runtime, не `?? 0` и не `bagStack || 9999`.
Unique paperdoll/bag: `bagStack = 1`, стакать нельзя. `priceMinor` missing ≠ 0.

9095: `priceMinor: 0`, `flags: 40`, `bagStack: 1`. Provenance: live dump
instance flags/price; unique wearable. Bundle сейчас `playable-slice/v23`.

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
USE/GIVE/WAREHOUSE в этом срезе не эмитить; `CAN_BE_UPGRADED=512` — INV-06.

### Public ports

Inventory:

- `drop({ characterId, itemId, amount? })` — lock items, throw-away или
  сигнал void-sell (без записи `heroes`);
- `bagLoad({ characterId })` → `{ amount, total, amountMax }` для bag wire и
  WLD-01 travel overload.

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

Pocket, USE, mail GIVE, COME_IN overload, store buy beyond
504 lots 23/24 ([STORE.md](STORE.md)), grant/merge
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
отдаёт пояс для wire и CMB-02 loadout без fight RAM.

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

`playable-slice/v23`. Pocket occupancy — partial unique в `0000_foundation_init`.

| id  | title                 | picture                  | typeId | kindId | slotMask  | weight | priceMinor | flags | bagStack |
| --- | --------------------- | ------------------------ | ------ | ------ | --------- | ------ | ---------- | ----- | -------- |
| 93  | Малый эликсир жизни   | `bottles_live1_2712.png` | `"7"`  | 154    | 67108864  | 100    | 100        | 0     | 99       |
| 99  | Малый усиливающий орб | `bottles_sila1.png`      | `"7"`  | 152    | 603979776 | 10     | 15         | 0     | 999      |

Dump: `interesting_full.json` `user|pocket` (price 1.0 / 0.15, flags 0, empty
skills). Weight/bagStack: `ARCHITECTURE.md` примеры. `levelMin=1`, `levelMax=0`,
`skills=[]`. Spell blob не публиковать. `artifact_actions` у 93/99 пустые;
USE мяса 77 — INV-04.

Starter: 9095×1 bag, 93×2 bag, 99×10 bag. Не выдавать 209, броню 20/26/103,
сундук 1518.

### Public ports

- расширить `putOn` (или соседний `putOnPocket`) опциональным `pocketPosition`;
- `putOff` уже существующий — уметь pocket→bag;
- `listPocket({ characterId })` — ordered snapshot для wire и CMB-02 loadout.

OA: decode `slot_num` на существующем `PutOnCommand`. Новых `requiredKeys` нет.

Lock: hero + `lockForHero` + `syncResources`, как PUT_ON. Не
`applyEquipmentVitals` для пояса (нет `artifact_skills`).

### Out of scope

Fight `castSpell` / `persSpells` / `rs` ordering, USE из bag, медальон 209,
патронташ, TEMPEFFECT drinks. Refill пояса — CMB-03. Durability — INV-05.

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
`artifact_actions["5"].code=ADD_HP`, `param1=30`, `param2=0`, `dispose=1`,
`title` «Съесть мясо». `level_min=0`; `level_max` live-сентинел `536870911`
**не копировать** → `0`. `bagStack` в Pub1 AMF — `9999`; slice INV-04 держал
именованный food-stack `99`. Wire `artifact_actions` — **map**, не array.
Ключ `"5"` — `row.id` из `artifact_artikul_77.amf` (`DATA-02`). Старый
handwritten slice ставил `"20"` без AMF evidence.

Bag `actions` = `FLAG_DROP\|FLAG_SELL\|FLAG_USE` = **7**, без PUT_ON.
Starter: 9095×1, 93×2, 99×10, **77×4** bag.

### Public ports

- `useFromBag({ characterId, itemId })` — lock items, consume по `dispose`;
- catalog `artifact(id).useAction` — первая typed action или отсутствует;
- character: `syncResources` + `noteHp` на locked hero в OA UoW.

OA: новый `UseArtifactCommand`, не ветка внутри PUT_ON. Новых URL нет.

### Out of scope

ADD_MP, DRINK/TEMPEFFECT, books/`bonus_id`, waiting, openDialog, recipes,
ghost. Durability — INV-05.

### INV-04 acceptance

- unit: percent/abs ADD_HP, missing param fail-fast, actions=7 vs empty `{}`;
- integration: consume last charge deletes row; concurrent USE one winner;
  rollback leaves HP and cnt;
- raw-AMF: wounded USE 77 → HP +gain, cnt−1, flat USE; full HP consumes;
  fight `203`; 9095/93/99 `203`; reconnect;
- CEF: съесть мясо из bag, стак падает; без каста в бою — **подтверждено**
  (4× USE `100`, 77 съеден целиком);
- нет fake OA; нет хлеба/маны/DRINK.

### CEF 2026-09-08

Новый герой, четыре USE мяса, `status:100`, без `user|view`, стек в PostgreSQL
пуст. Restart покрыт raw-AMF e2e.

## INV-05 — durability, death loss and repair

### Architecture decision

Отдельный `ARC-INV` / `ARC-ECO` не нужен. Instance durability — колонки
`inventory.items.durability` / `durability_max`, не JSON. Catalog владеет
шаблоном (`artifacts.durability` / `durability_max`) и `priceMinor`/`flags`.
Character владеет золотом через `debitMoney`. Combat не пишет `items`.
Death: composition `HuntFightSettlement`, та же UoW что `noteDefeat`, порт
`applyDeathDurability`. Repair: composition `StoreRepair`, та же схема что
ECO-01 buy (inventory mutation + `debitMoney`). Economy-модуля нет.
`flags_ext` не добавлять: infinite = `flags & 1` (NON_BREAK) и
`flags & 536870912` (COLLECTS_EPICNESS). Chat notify — `SOC-01`
`Вещи потеряли прочность: [[ARTIFACT_ITEM]] (-1).` после death/win break
(raw-AMF). CEF leftover.

### Правила

`durabilityMax > 0` или infinite → предмет tracks durability. `0`/`0` —
еда/пояс/спеллы, прочность не ведётся. Instance копирует catalog при create.
Не `Number(x) || 0` и не catalog overlay поверх missing instance.

**Коррекция по `DATA-02` full-corpus audit.** `durability <= durabilityMax`
как обязательный invariant был выведен только из 7 представительных
предметов минимального slice (все `X/X`) и не подтверждён legacy-кодом:
`jgr-emu/src/db/seed_artifacts.ts` пишет оба поля из AMF verbatim
(`Number(d["durability"]) || 0`), без сравнения; `jgr-emu/src/durability.ts`
(`tracksDurability`/`canRepair`/`applyBreak`) не требует `current <= max` и
безопасно обрабатывает `current > max` (не ломается, не даёт отрицательных
значений — просто не считает предмет «battle broken» и не даёт repair,
т.к. `current < max` ложно). Полный Pub1-корпус (`DATA-02`, 22 560
artifacts) содержит **37 записей** с `durability > durabilityMax`,
систематически `durabilityMax = 1` при разном `durability` (4/15/30) —
например `1904` «Патронташ первооткрывателя», `5775` «Клепаная кираса»,
`1883` «Шлем тирана (тестовый)». Это live dump evidence (rank 1 по
`SOURCE_BOUNDARY.md` § «Приоритет доказательств»), не decode-баг: значения
дублируются в generated corpus между запусками. Правило исправлено:
инвариант — только `durability >= 0` и `durabilityMax >= 0`, `current`
может превышать `max` для отдельных legacy-предметов (сохраняется как
`legacy behavior`, не «исправляется» до консистентности). Затрагивает
идентичный constraint `*_durability_range_check` на пяти таблицах:
`catalog.artifacts`, `inventory.items`, `trade.held_items`,
`mail.letter_attachments`, `auction.listings` — все копируют шаблон
catalog/instance без клэмпинга, все должны быть согласованно ослаблены
одной миграцией.

Смерть (hp 0 на hunt finish): pool = надетые tracking с `current > 0`, без
TEMPEFFECT; `pickDeathBreaks` 4–5 или весь pool. −1; finite `1/1` delete;
`0/N` PUT_OFF в bag. RNG — `RandomSource.unit` на settlement. Win тоже
ломает, если hunter hp 0 (live rewards loop). Practice fights в j-emu нет.

PUT_ON `0/N` — **204** `Эту вещь нельзя надеть!` (`BrokenItemError`).
Level/gender WearDenied остаётся **203**. Bag `actions` без PUT_ON если
broken.

Repair OA `store|repair` form `{ id }` — instance id. Live не проверяет
`area.code=store`. Finite → `(max−1)/(max−1)`; infinite → fill current.
Цена золотом: `min(50, round(priceGold * 0.02 * 100) / 100)`, затем
`goldToMinor`. `priceMinor=0` → cost 0, debit не вызывать. Cannot repair /
missing item **203** `нельзя починить`. Недостаточно денег **2**
`Недостаточно денег`. Ghost/fight не блокируют (live).

### Content

`playable-slice/v23`. Все артефакты обязаны иметь оба поля.

| id                 | occupancy bit | dur   | provenance                                |
| ------------------ | ------------- | ----- | ----------------------------------------- |
| 21                 | FOOT 1        | 30/30 | dump `interesting_full` «Простые сапоги»  |
| 20                 | BODY 2        | 30/30 | dump + `CHARACTER_STATS` «Простая кираса» |
| 26                 | LEG 4         | 30/30 | dump + `CHARACTER_STATS` «Простые поножи» |
| 24                 | 16            | 30/30 | dump, store lot 82 (L2)                   |
| 9095               | 32            | 3/3   | dump + `CHARACTER_STATS`                  |
| 23                 | 32            | 30/30 | dump, store lot 80 (L2)                   |
| 77/93/99/9098–9100 | —             | 0/0   | не tracking                               |

Starter bag: 9095, 20, 21, 26, 93×2, 99×10, 77×4. Не надевать серые доспехи
на login. 103 с `expire` не публиковать.

### Public ports

- `applyDeathDurability({ characterId, random })` → `{ paperdollChanged, breaks }`;
- `repair({ characterId, itemId })` → `{ costMinor }` (0 = free, no debit);
- catalog template durability on `ArtifactDefinition`;
- composition `StoreRepair` debit + repair в одной UoW.

### Wire

Bag/view/store-lot несут instance или catalog `durability` /
`durability_max`. `store|repair` success **flat**: `store|repair`
`{status:100}`, `user|bag`, `user|view`, `user|magic`, `state`.

### Fail-fast / restart

Нет catalog durability на artifact — публикация падает. Missing instance
columns — runtime 204. Concurrent death/repair — hero+items lock, один
победитель. Reconnect/restart читает PostgreSQL.

### Out of scope

set-bonus INV-07; 103 expire; BAG slots; flags_ext /
draconis infinite; workshop tab client filter (client-side
`dur < max`).

### INV-05 acceptance

- unit: break/repair/cost/pick 4–5; PUT_ON omit when broken;
- integration: persist death −1 and repair `(max-1)/(max-1)`; concurrent
  repair one winner;
- raw-AMF: four L1 durables equipped, hunt loss, 4 broken, 0/N in bag,
  PUT_ON 204; system chat `Вещи потеряли прочность: [[ARTIFACT_ITEM]] (-1)`;
  repair 9095 cost 0 → 2/2; repair 20 cost 0.02g; restart;
- CEF мастерской не прогонялся — product **частично**, пока нет CEF
  20/21/26/9095 → смерть о Грызля → снятие 0/N → починка в 504.

## INV-06 — upgrade / enchant chain

### Architecture decision

Отдельный `ARC-*` не нужен. Identity — mutate in place, тот же
`inventory.items.id`. Overlay — колонки `upgrade_id` / `upgrade_level` /
`upgrade_skill_id` / `upgrade_bound`, не instance JSON. Catalog владеет
кристаллами `ARTIFACT_UPGRADE` и named tables types 1–3
(`upgrade-tables.ts`, копия Pub1 `common.amf`). RNG — `{ unit(): number }`
на `InventoryService`. Combat `RandomSource` в inventory domain не
импортируется.

Одна UoW: consume crystal, затем (успех) update target. Roll-fail
**коммитит** consume и отдаёт flat `203`. Deny до consume —
`UpgradeDeniedError` → nested `203`. Type 4 и не-bag цели — nested `203`
`"Это действие предмета пока не поддержано."`. Fight —
`"нельзя во время боя"`.

Резонатор (`param1 & 2`) не меняет `upgrade_level`; перебрасывает combat
stat из пула. Types 2 и 3 — одна lineage. Bonus =
`ceil(catalogBase × mult[level])`. Bind `flags |= 32` на уровне 6 или
кристаллах 553/605/13779.

### Content

`playable-slice/v23`. Dump `Pub1/images/locale/ru/amf/artifact_artikul_*.amf`.
`bagStack` 9999 — authored cap для weight-0 type 73. `level_max=-1` → `0`,
кроме 13224 (`35`).

| id    | title                        | param2 | notes                   |
| ----- | ---------------------------- | ------ | ----------------------- |
| 553   | Древний кристалл заточки     | 1      | bind-on-first; flags 40 |
| 1310  | Обычный кристалл заточки     | 2      | flags 0; param1=0       |
| 4603  | Ледяной кристалл заточки     | 3      | 100%; starter ×6        |
| 11408 | Волшебный резонатор заточки  | 2      | param1=3                |
| 13224 | Адамантовый кристалл заточки | 4      | refuse; levelMax 35     |

Skills `INJ_PROB` / `BLOK` / `BLOK_VISUAL` обязательны для level-6 extras.
Target: **20**. USE кристалла остаётся `203`; клиент шлёт OA `UPGRADE`.
Starter: прежний bag плюс `4603×6`, `11408×1`, `1310×1`, `553×1`, `13224×1`.

### Public ports

- `applyGearUpgrade({ characterId, crystalItemId, targetItemId })` →
  `{ ok: true } | { ok: false, error }`;
- overlay skills на equipped read.

### Wire

OA `common|object:UPGRADE`: crystal = `form.object_id`, target =
`in.artifact_id`. Success flat: `{status:100, action:"UPGRADE"}` +
`user|bag` + `user|skills`. Consumed fail: те же blocks с
`{action:"UPGRADE", status:203, error}`. Unconsumed deny: nested `203`.
Bag bit `CAN_BE_UPGRADED=512`. Карточка: `upgrade_id` / `upgrade_level` /
`upgrade_add`; skill `value` = catalog + bonus и `upgrade_value`.

### INV-06 acceptance

- unit: chance/mult, overlay, resonator same level, 2↔3 compatible, type 4
  refuse, roll fail;
- integration: persist overlay, concurrent one winner, fail-roll consumes
  crystal;
- raw-AMF: 6× type 3 on 20; resonator re-picks; type 4 nested 203; fail-roll
  flat 203 + bag; restart; fight 203;
- CEF диалога заточки отложен до редактора; product **частично**.

## INV-07 — set bonuses and gear-spell hook

### Architecture decision

Отдельный `ARC-*` не нужен. Бонус комплекта — по `extra.set.id`, не по
цвету и не по `trend`. `trend` 1/2/3 блокирует PUT_ON микса (`204`
«Эту вещь нельзя надеть!»). Kind-139 строка живёт в тех же `inventory.items`
с новым `location_kind=tempeffect` (несколько строк на героя; unique слота
нельзя — несколько сетов сразу). Wire: slot `134217728`, `expire:0`,
`cnt:0`. Picture у **106** в dump пустая — catalog это допускает только для
kind 139. Портрет — только wire overlay. Combat не читает inventory tables:
порт `equippedGearSpells` отдаёт `extra.spell` с nonempty effects; combat
вешает RAM kind-3 на **старт боя** (GEAR-01), не на PUT_ON. Inventory не
копирует блоб на `items` и не держит fight effect. Recruit AMF `spell` без
`effects` в срез не тащим как боевой hook.

### Content

Pub1 AMF. Сет **47** «Рекрута»: **30, 33, 35, 27, 28** + **106**. Mix:
**43** trend 1, **46** trend 3. `level_boundaries` 9–14, чтобы надеть L12
шлем. `MAGSTR` в skills. Стартовый bag не выдаёт L10+ шмот. L15 не
публикуем: dump `expMax=expMin`. Существующие nonempty DB: `npm run db:reset`
из‑за progression digest.

### INV-07 acceptance

- unit: set_id / bonusN / mix / portrait at 4;
- integration: TEMPEFFECT 106 persist, concurrent PUT_ON one winner;
- raw-AMF: 4 вещи → avatar overlay; 5 → 106 skills; mix 204; restart;
- CEF после редактора; product **частично**.

## QST-ENG-03 — REMOVE by artikul (bag or paperdoll)

Landed. Канон: [QUESTS.md](QUESTS.md). Inventory остаётся owner
экземпляров. Public `consumeByArtikul({ allowPaperdoll })`: сначала bag,
иначе paperdoll (включая `cnt=0`); нет экземпляра — skip, не 203 и не чат
«Изъято». Quests/`items` напрямую не пишут. `allowPaperdoll` ложь, пока
есть active fight; `afterFinished` идёт после снятия боя с RAM, поэтому
quest-win REMOVE снимает надетый слот. `fight|finish` отдаёт
`user|view.artifacts`.

## GEAR-01 — paperdoll extra.spell

Inventory остаётся owner instance и read-only `equippedGearSpells` / `list`.
PUT_ON 20546 вне боя только меняет location (слот 32); fight packets нет.
В бою layout — FightRules `203`. Снимок `gearSpells[]` собирает
`HuntCombatLoadout` на старт боя; combat domain mid-fight inventory не
читает. Сокеты комбо 20546 в срез не входят: пустые `extra.spells[]` →
`glove: null`, gear-spell всё равно в snapshot.

## INV-08 — USE pipeline

Typed registry, not a JSON interpreter. OA `UseArtifactCommand` orchestrates;
inventory не пишет `hero_skills`. Clock injected. Purge timed drinks
(`expire>1 && expire<=nowSec`, skip 0/1 и kind 139) на USE и
view/skills/unitframe.

- **640** DRINK → TEMPEFFECT, `expire = now+1800`, piggyback `user|view` +
  `user|skills`, `msg_text` «Вы использовали {action.title}.»;
- **623** empty code + bonus **601** → `AGRILKA_MOBOV` `"1"`, без `chatMsg`;
- **2371**×2 + script **2827** → grant **55**;
- **584** `NPC` → `203` «действие «NPC» пока не поддержано»;
- ADD_MP — dispatcher + unit formula, no slice item.

`inventory.items.expire` NOT NULL, app-set. Catalog `bonuses` / `use_scripts`.
`character.hero_learned_bonuses`. Drink PUT_OFF deletes; kind 139 still
resyncs.

### INV-08 acceptance

- unit: drink displace/expire, learn 0→1 / too-wise / too-green, ADD_MP formula;
- integration: meat USE persist/concurrent; expire column;
- raw-AMF: 640 / 623 / 2371 / 584; meat 77 regression;
- CEF after editor; product **частично**.

## Architecture checkpoint — план

INV-08 и GEAR-01 inventory-hook workflow `done`. Очередь — [ROADMAP.md](../migration/ROADMAP.md).
Containers, reservations не спроектированы.

## Acceptance

- UI и PostgreSQL совпадают после каждой mutation;
- повтор/гонка не дублирует, не теряет и не создаёт item;
- item IDs остаются стабильными после restart;
- malformed/missing catalog data дают explicit error;
- raw-AMF response сохраняет legacy flat shape;
- paperdoll 9095 **готово** подтверждён CEF PUT_ON (статы и bag);
  Unity-модель `user|view.body` — leftover CEF после импорта `f_body`;
- DROP throw-away 9095 **готово** подтверждён CEF из bag;
- pocket 93/99 **готово** подтверждён CEF PUT_ON на пояс;
- world USE 77 **готово** подтверждён CEF из bag;
- durability/repair **частично**: raw-AMF E2E есть, CEF мастерской нет;
- upgrade **частично**: raw-AMF E2E есть, CEF диалога заточки отложен;
- set-bonus **частично**: raw-AMF E2E есть, CEF сетов отложен;
- USE pipeline **частично**: raw-AMF 640/623/2371/584 есть, CEF выдачи нет;
- paperdoll extra.spell **частично**: PUT_ON 20546 без fight packets
  (raw-AMF); attach в бою — [COMBAT.md](COMBAT.md) GEAR-01, CEF нет.
