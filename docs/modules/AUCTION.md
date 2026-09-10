# Auction (AUC-01)

## Статус

Лоты: list/page, my_lot, my_bid, min_price, lot_add, bid, buyout, cancel и
TTL expiry реализованы на raw-AMF. CEF аукциона не прогонялся — product-status
**готово** не ставить. Точный product-status:
[CAPABILITIES.md](../CAPABILITIES.md).

Заказы (`tender_*`) — AUC-02, в этом срезе не регистрируются.

## Источники поведения

- `jgr-emu/docs/AUCTION.md`;
- `jgr-emu/src/auction/` (`index.ts`, `listings.ts`, `search.ts`, `wire.ts`,
  `tax.ts`, `sweep.ts`).

Не переносить playerbots, `addToLot`, market journal и NPC-сиды stub.

## Architecture decision

Отдельный `ARC-ECO` не нужен. Аукцион — модуль `auction`
(`src/modules/auction`), не target `economy` и не `social`.

Владение:

- `auction` пишет только `auction.listings`;
- деньги — `heroes.money_minor` через character `debitMoney`;
- bag — inventory take-by-instance;
- settlement — mail `deliverSystemInbox` (снимок + золото), `bypassCapacity`.

Composition UoW атомарно списывает bag+налог (add), ставку/выкуп (bid/buyout)
и доставляет почту. Auction не пишет `heroes`, `inventory.items` и `mail.*`.
Inventory не пишет `auction.*`. Mail не пишет `auction.*`. Character не
пишет `auction.*`.

Ledger, отдельный депозит и `location_kind: auction` не вводятся. Текущая
ставка лежит на лоте (`current_bid_minor` + `bidder_hero_id`). Налог
листинга не возвращается.

IDs лотов выдаёт PostgreSQL identity с `1`. Wire integer
`1..2_147_483_647`. `bid_user_id=0` на wire — dump «нет ставки», не runtime
id.

Клиентский гейт уровня 6 сервер **не** проверяет. Fight lock / ghost dump на
`auction|*` не ставит — не выдумывать. `allowGhost: true` на debit.

## Снимок, не reservation

Dump хранит AMF JSONB `artifact_json` и уничтожает bag-строку. Target
`economy` «reservation» — план, не runtime.

**Решение AUC-01:** колонки снимка на `auction.listings` (как MAIL-02
attachments, не JSONB). Живой `items` row на лоте не держим.

`lot_add` берёт bag **по `items.id`**, не по catalog `artikul_id`. NOGIVE
(`flags & 32` или bound upgrade) и клановые (`flags & 8388608`) → 203
`непередаваемый предмет`. Не-bag → `предмет не найден в рюкзаке`.

Гонка buyout/bid/cancel/sweep: `SELECT FOR UPDATE` строки лота в той же UoW.
Один победитель; второй buyout → 203 `лот уже куплен`, деньги не списывать.
Проигравшая ставка при buyout/overbid — письмо «Аукцион: ставка не выиграла»,
не 203 (её `bid` уже прошёл).

Rollback UoW возвращает bag и золото, dump-стиль «grant back» не нужен.

## TTL sweep

Как почта: на `lot` / `my_lot` / `my_bid` / `min_price` / add / bid / buyout /
cancel **и** process `DelayScheduler` ~30с, не отдельный worker. Истекшие с
`rtime_num==0` в выдачу не попадают.

- лот без ставки → `expired`, вещь продавцу, тема «Аукцион: возврат»;
- лот со ставкой → `sold`, вещь биддеру («Аукцион: покупка»), золото ставки
  продавцу («Аукцион: продажа»). Налог не возвращается.

Chat не будить. Playerbots нет.

## Add / bid / buyout / cancel

`duration` ∈ {2, 8, 24} часов. Start ≥ **0.21** g. Buyout `0` валиден
(кнопки нет) либо **> start × 1.05** (dump `minBuyout`).

Налог: `max(0.01, 0.01 * catalog_price * qty * mult)`, `2ч→1`, `8ч→1.11`,
`24ч→1.4`, округление до копейки. Хранение — minor.

`bid`: чужой open лот; не своя ставка; `bid > current` если ставка уже есть,
иначе `bid >= start`. Списывается и лежит на лоте. Предыдущему биддеру —
письмо + золото.

`buyout`: выкуп > 0. Вещь **не** в bag — только почта. Висевшая чужая ставка
— refund письмом.

`cancel`: только свой лот **без** ставки. Со ставкой → 203. Налог не
возвращается. `cancel` в wire — UI-стоимость (налог), `0` чужому и лоту со
ставкой.

`min_price`: минимум listed unit (buyout если > 0, иначе current/start) ×
`amount` среди open лотов того же артикула. Нет таких → 203 `Таких лотов нет.`

Страница **100**. Пустой `list` = `[]`. Непустой — **массив** (HAR), не объект.

## Schema (`auction`)

`auction.listings`: identity id, `kind` пока только `lot` (tender — AUC-02),
`status` `open|sold|cancelled|expired`, owner FK heroes, `owner_kind` для
фильтра `user_kind`, search scalars (title, kind_id, quality, level_min,
amount), цены minor, `bidder_hero_id`, `cancel_fee_minor`, `expires_at` /
`created_at` timestamptz, снимок durability/upgrade/`original_item_id`.

`quality` на лоте — dump `artikuls.quality`. В текущем catalog slice колонки
нет: лот пишет **0**, пока catalog не публикует quality. Это не fallback
отсутствующего артефакта.

Unix time и `rtime` «Много/Средне/Мало» только в jugger-wire mapper.

## Public ports

Auction: `searchLots` / `listMine` / `listMyBids` / `minUnitPriceMinor`,
`insert`, `lock`, `lockExpired`, `save`, `sweepExpired` (status+mail через
composition).

Inventory: `takeFromBagForAuction` (instance id).

Character: `getById`, `lockById`, `debitMoney`.

Mail: `deliverSystemInbox`.

Composition: `AuctionBoard`, `AuctionList`, `AuctionBid`, `AuctionBuyout`,
`AuctionCancel`, `AuctionTtlSweep` на общем `DelayScheduler`.

## Wire

| OA                   | Форма                                                                                                                | Успех                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `auction\|lot`       | `title`, `level_min`/`max`, `count_min`/`max`, `kind[]`, `quality` (−1 любой), `user_kind[]`, `order`, `rev`, `offs` | nested `{ status:100, list, total, offs }`                                        |
| `auction\|my_lot`    | —                                                                                                                    | nested `{ status, list }`                                                         |
| `auction\|my_bid`    | —                                                                                                                    | nested `{ status, list }`                                                         |
| `auction\|min_price` | `artifact_id`, `amount`                                                                                              | nested `{ status, buyout }`                                                       |
| `auction\|lot_add`   | `artifact_id`, `amount`, `start_price`, `buyout`, `duration` ∈ {2,8,24}                                              | flat: OA `{status:100}` + `user\|bag` + `state`                                   |
| `auction\|bid`       | `lot_id`, `bid`                                                                                                      | flat: OA `{status, lot_id, bid}` + bag + state                                    |
| `auction\|buyout`    | `lot_id` + `filters{ action:"lot", …поиск }`                                                                         | flat: `auction\|buyout` + `common\|dummy` + свежий `auction\|lot` + bag + `state` |
| `auction\|cancel`    | `lot_id`                                                                                                             | flat: OA + `auction\|my_lot` + bag + state                                        |

LotData: `id`, `artifact` (bag-шейп, `cnt` = amount), `amount`, `rtime` /
`rtime_num`, `bid`, `buyout`, `cancel`, `flags`, `user_id` string,
`user_nick` `[[USER key]]`, `bid_user_id` string, `overbid` 0,
`overbid_user` `""`, `price_type: 1`, `macroses` массив CharacterInfo.
Пустой `clan_picture` не слать.

Flags (per viewer): `MY_LOT=1`, `MY_BID=2`. `WHOLE_STACK_ONLY=4` — AUC-02.

Ошибки: **203** + `error`. Не слать `error` на 100.
