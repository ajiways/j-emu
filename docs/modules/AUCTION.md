# Auction (AUC-01 / AUC-02)

## Статус

Лоты и заказы реализованы на raw-AMF. CEF аукциона не прогонялся — product-status
**готово** не ставить. Точный product-status:
[CAPABILITIES.md](../CAPABILITIES.md).

Не переносить playerbots, `addToLot` и market journal.

## Источники поведения

- `jgr-emu/docs/AUCTION.md`;
- `jgr-emu/src/auction/` (`index.ts`, `listings.ts`, `search.ts`, `wire.ts`,
  `tax.ts`, `sweep.ts`).

## Architecture decision

Отдельный `ARC-ECO` не нужен. Аукцион — модуль `auction`
(`src/modules/auction`), не target `economy` и не `social`.

Владение:

- `auction` пишет только `auction.listings`;
- деньги — `heroes.money_minor` через character `debitMoney`;
- bag — inventory take-by-instance;
- settlement — mail `deliverSystemInbox` (снимок + золото), `bypassCapacity`.

Composition UoW атомарно списывает bag+налог (lot add), ставку/выкуп, заказ
(налог+hold) и fill. Auction не пишет `heroes`, `inventory.items` и `mail.*`.
Inventory не пишет `auction.*`. Mail не пишет `auction.*`. Character не
пишет `auction.*`.

Ledger, отдельный депозит и `location_kind: auction` не вводятся. На лоте —
текущая ставка (`current_bid_minor` + `bidder_hero_id`). На заказе — оставшийся
`buyout_minor`. Налог не возвращается.

IDs выдаёт PostgreSQL identity с `1`. Wire integer `1..2_147_483_647`.
`bid_user_id=0` на wire — dump «нет ставки», не runtime id.

Клиентский гейт уровня 6 сервер **не** проверяет. Fight lock / ghost dump на
`auction|*` не ставит — не выдумывать. `allowGhost: true` на debit.

**Решение AUC-01:** колонки снимка на `auction.listings` (как MAIL-02
attachments, не JSONB). Живой `items` row на лоте не держим.

**Решение AUC-02:** тот же `auction.listings`, `kind='tender'`. Hold заказа —
оставшийся `buyout_minor`. Partial fill — `SELECT FOR UPDATE` строки; два
`tender_sell` на последний cnt: первый 100, второй 203 `заказ уже закрыт`.
Заказ не берёт bag при create: `original_item_id=0` (нет instance). Fill берёт
bag продавца by instance и шлёт снимок заказчику почтой.

`lot_add` берёт bag **по `items.id`**, не по catalog `artikul_id`. NOGIVE
(`flags & 32` или bound upgrade) и клановые (`flags & 8388608`) → 203
`непередаваемый предмет`. Не-bag → `предмет не найден в рюкзаке`.
`tender_add` режет NOGIVE/clan по **catalog flags**.

Гонка buyout/bid/cancel/sell/sweep: `SELECT FOR UPDATE` строки в той же UoW.

Rollback UoW возвращает bag и золото, dump-стиль «grant back» не нужен.

`quality` на листинге — dump `artikuls.quality`. В текущем catalog slice
колонки нет: пишем **0**, пока catalog не публикует quality. Это не fallback
отсутствующего артефакта.

`magic_id` на заказе dump сверяет `artifact_skills` instance. В текущем bag
slice skills нет: заказ с `magic_id>0` из bag не закрыть (не выдумывать match).
Durability / `upgrade_level` сверяются с instance.

## TTL sweep

Как почта: на lot / tenders / my\_\* / min_price / add / bid / buyout / cancel /
sell **и** process `DelayScheduler` ~30с, не отдельный worker. Истекшие с
`rtime_num==0` в выдачу не попадают.

- лот без ставки → `expired`, вещь продавцу, тема «Аукцион: возврат»;
- лот со ставкой → `sold`, вещь биддеру («Аукцион: покупка»), золото ставки
  продавцу («Аукцион: продажа»);
- заказ → `expired`, оставшийся `buyout` заказчику («Аукцион: возврат»).

Chat не будить. Playerbots нет.

## Add / bid / buyout / cancel (лоты)

`duration` ∈ {2, 8, 24} часов. Start ≥ **0.21** g. Buyout `0` валиден
(кнопки нет) либо **> start × 1.05** (dump `minBuyout`).

Налог лота: `max(0.01, 0.01 * catalog_price * qty * mult)`, `2ч→1`, `8ч→1.11`,
`24ч→1.4`, округление до копейки. Хранение — minor.

`bid`: чужой open лот; не своя ставка; `bid > current` если ставка уже есть,
иначе `bid >= start`. Списывается и лежит на лоте. Предыдущему биддеру —
письмо + золото.

`buyout`: выкуп > 0. Вещь **не** в bag — только почта. Висевшая чужая ставка
— refund письмом. Второй buyout → 203 `лот уже куплен`.

`cancel`: только свой лот **без** ставки. Со ставкой → 203. Налог не
возвращается. `cancel` в wire — UI-стоимость (налог), `0` чужому и лоту со
ставкой.

`min_price`: минимум listed unit (buyout если > 0, иначе current/start) ×
`amount` среди open лотов того же артикула. Нет таких → 203 `Таких лотов нет.`

Страница **100**. Пустой `list` = `[]`. Непустой — **массив** (HAR), не объект.

## Заказы (AUC-02)

Налог заказа: **1g**, не возвращается. TTL **24ч**. Debit = налог + `buyout`.

`tender_add`: `artikul_id` каталога, `amount` ≥ 1 (dump: отсутствующий amount →
1), `buyout` > 0, опц. `only_entirely`, `required_durability` /
`required_durability_max` / `magic_id` / `required_upgrade_id` (0 = не
фильтровать).

`tender_sell`: чужой open заказ. `artifact_id` — instance в bag (qty всегда 1);
без него — первый bag stack того же артикула, `cnt` clamp к stack и remaining.
`only_entirely` запрещает частичный fill. Pay = unit × qty, unit =
оставшийся buyout / amount. Вещь заказчику («Аукцион: покупка»), золото
продавцу («Заказ: лот выкуплен»). Не слать `{lot_id, amount, price}` вместе со
списком: AS3 вычтет `amount` из уже обновлённой строки.

`tender_cancel`: свой open заказ; оставшийся buyout на почту. Налог нет.

`tenders` + `available="1"`: только заказы, которые viewer может закрыть из
bag (dump: unpaged scan, потом page 100).

## Schema (`auction`)

`auction.listings`: identity id, `kind` `lot|tender`, `status`
`open|sold|cancelled|expired`, owner FK heroes, `owner_kind`, search scalars,
цены minor, `bidder_hero_id`, `cancel_fee_minor`, `expires_at` / `created_at`
timestamptz, снимок durability/upgrade/`original_item_id` (лот > 0; заказ 0),
фильтры заказа `whole_stack_only`, `required_durability`,
`required_durability_max`, `magic_id`, `required_upgrade_id`. Open `amount>0`;
sold заказ может иметь `amount=0`.

Unix time и `rtime` «Много/Средне/Мало» только в jugger-wire mapper.

## Public ports

Auction: `searchLots` / `searchTenders` / `listMine` / `listMyBids` /
`minUnitPriceMinor`, `insert`, `lock`, `lockExpired`, `save`.

Inventory: `takeFromBagForAuction` (instance id), `list` (available/fill match).

Character: `getById`, `lockById`, `debitMoney`.

Mail: `deliverSystemInbox`.

Composition: `AuctionBoard`, `AuctionList`, `AuctionBid`, `AuctionBuyout`,
`AuctionCancel`, `AuctionTenderAdd`, `AuctionTenderSell`, `AuctionTenderCancel`,
`AuctionTtlSweep` на общем `DelayScheduler`.

## Wire

| OA                       | Форма                                                                                                                | Успех                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `auction\|lot`           | `title`, `level_min`/`max`, `count_min`/`max`, `kind[]`, `quality` (−1 любой), `user_kind[]`, `order`, `rev`, `offs` | nested `{ status:100, list, total, offs }`                                        |
| `auction\|my_lot`        | —                                                                                                                    | nested `{ status, list }`                                                         |
| `auction\|my_bid`        | —                                                                                                                    | nested `{ status, list }`                                                         |
| `auction\|min_price`     | `artifact_id`, `amount`                                                                                              | nested `{ status, buyout }`                                                       |
| `auction\|lot_add`       | `artifact_id`, `amount`, `start_price`, `buyout`, `duration` ∈ {2,8,24}                                              | flat: OA `{status:100}` + `user\|bag` + `state`                                   |
| `auction\|bid`           | `lot_id`, `bid`                                                                                                      | flat: OA `{status, lot_id, bid}` + bag + state                                    |
| `auction\|buyout`        | `lot_id` + `filters{ action:"lot", …поиск }`                                                                         | flat: `auction\|buyout` + `common\|dummy` + свежий `auction\|lot` + bag + `state` |
| `auction\|cancel`        | `lot_id`                                                                                                             | flat: OA + `auction\|my_lot` + bag + state                                        |
| `auction\|tenders`       | те же фильтры + `available` `"0"`/`"1"`                                                                              | nested `{ status, list, total, offs }`                                            |
| `auction\|my_tenders`    | —                                                                                                                    | nested `{ status, list }`                                                         |
| `auction\|tender_add`    | `artikul_id`, `amount`, `buyout`, опц. `only_entirely` / durability / magic / upgrade                                | flat: OA `{status:100}` + bag + state                                             |
| `auction\|tender_cancel` | `lot_id`                                                                                                             | flat: OA + `auction\|my_tenders` + `auction\|tenders` + bag + state               |
| `auction\|tender_sell`   | `lot_id`, опц. `artifact_id`, `cnt`, `filters`                                                                       | flat: `{status:100}` + свежий `auction\|tenders` + bag + state                    |

LotData: `id`, `artifact`, `amount`, `rtime` / `rtime_num`, `bid`, `buyout`,
`cancel`, `flags`, `user_id` string, `user_nick` `[[USER key]]`, `bid_user_id`
string, `overbid` 0, `overbid_user` `""`, `price_type: 1`, `macroses` массив
CharacterInfo. Пустой `clan_picture` не слать.

На лотах `artifact` — bag-шейп, `cnt` = amount, `id` = instance. На заказах —
static catalog (`id` = artikul, `cnt` = 1) плюс string
`required_durability` / `required_durability_max` / `required_upgrade_id` /
`magic_id`. `bid` заказа = оставшийся buyout.

Flags (per viewer): `MY_LOT=1`, `MY_BID=2`, `WHOLE_STACK_ONLY=4`.

Ошибки: **203** + `error`. Не слать `error` на 100.
