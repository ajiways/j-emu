# Trade (TRD-01 / TRD-02)

## Статус

P2P обмен реализован на raw-AMF. CEF окна обмена не прогонялся — product-status
**готово** не ставить. Точный product-status:
[CAPABILITIES.md](../CAPABILITIES.md).

Не переносить playerbots, stub `TradeBot` и system-чат «согласился торговать»
(SOC-01 нет — чат не выдумывать).

## Источники поведения

- `jgr-emu/docs/TRADE.md`;
- `jgr-emu/src/trade/` (`index.ts`, `dispatch.ts`, `wire.ts`, `tax.ts`);
- dump `_research/2players_social_2026-08-11`; AS3 `modules/exchange`.

## Architecture decision

Отдельный `ARC-ECO` не нужен. Обмен — модуль `trade` (`src/modules/trade`), не
target `economy` и не `social`.

Владение:

- `trade` держит process-local сессию (тарелки, `confirm_key`, `confirmed`);
- деньги — `heroes.money_minor` через character `debitMoney` / `creditMoney`;
- bag — inventory take-by-instance и snapshot grant.

Composition UoW атомарно снимает bag на стол, возвращает при withdraw/decline и
меняет оба героя на settle. Trade не пишет `heroes` и `inventory.items`.
Inventory не пишет trade-state. Character не пишет trade-state.

Ledger, reservation rows и таблицы сессии не вводятся. Предметы на столе уже
сняты из bag (как dump). Рестарт процесса рвёт открытый обмен: вещи на столе
без `decline` не возвращаются. Disconnect/reconnect в том же процессе держит
ту же сессию (ключ — `heroes.id`).

Tray id — ephemeral in-process счётчик с `1` (как dump), не persisted identity и
не hunt-bot диапазон. Wire integer `1..2_147_483_647`.

`have_trade_channel` на area — catalog/world wire, не гейт движка обмена.
Fight lock / ghost / same-area dump на `trade|*` не ставит — не выдумывать.
`allowGhost: true` на debit.

Клиентский `ExhangeBagFrame` **не** фильтрует NOGIVE. Сервер режет `flags & 32`
и клановые (`flags & 8388608`) и bound upgrade на `trade|put` → 203
`непередаваемый предмет нельзя положить в обмен`, предмет остаётся в bag.

**Решение TRD-01:** сессия в RAM; инвайт `common|window` «Предложение торговли»
на `2:`; put/withdraw/put_money крутят `confirm_key` и сбрасывают `confirmed`.
Инвайтее биндится на `request` (`pendingInvitee`), тарелка появляется на
`confirm`.

**Решение TRD-02:** когда оба `confirmed=2`, одна UoW: `canFit` снимков,
`money ≥ pledged + tax`, grant снимков партнёру, debit pledged+tax, credit
pledged партнёра, unbind. Dump sequential grant+setMoney в j-emu не копировать.
Гонка двух `session_confirm` — serial gate процесса (как dump).

Withdraw/decline/settle выдают новый `items.id` (как MAIL-02 pick), не
восстанавливают `originalItemId`.

## Налог

```
V = money_in_tray + Σ (catalog price × cnt)
tax = 0.25 × V ^ log₁₀(5)
```

Wire — неотсечённый float (live 5×0.62 → `0.551298…`). Ready/settle округляют
**2dp**. Нужно `money ≥ pledged + tax`. Пустой V → налог 0. Списание 0 minor
не вызывается.

## OA

Ошибки `203` + `error`. Мутации Flat: `{oa: {status:100}, trade|session, state}`.

| OA                       | Form             | Успех                                                                     |
| ------------------------ | ---------------- | ------------------------------------------------------------------------- |
| `trade\|request`         | `{nick}`         | инициатор: `my_tray`, `opponent_tray: []`; инвайтее esrv `common\|window` |
| `trade\|confirm`         | `{tray_id}`      | оба видят две тарелки; инициатору esrv `trade\|session` (чат SOC-01 нет)  |
| `trade\|put`             | `{item, amount}` | bag → стол; NOGIVE/clan → 203; крутит ключ                                |
| `trade\|put_money`       | `{amount}`       | залог серебра, не списывается до settle                                   |
| `trade\|withdraw`        | `{item, amount}` | стол → bag                                                                |
| `trade\|session_ready`   | `{confirm_key}`  | `confirmed` → 1                                                           |
| `trade\|session_decline` | —                | `confirmed` → 0; если партнёр был 2 → 1; окно открыто                     |
| `trade\|session_confirm` | `{confirm_key}`  | `confirmed` → 2; оба 2 — settle, `trade\|session: {status:100}`           |
| `trade\|decline`         | опц. `{tray_id}` | отмена; вещи со стола в bag; `user\|bag`                                  |

`confirmed`: **0** правка / **1** готов / **2** принял. Confirm когда оба ≥ 1.

Пустой `nick` → `укажите ник`. Пустой `confirm_key` dump не сверяет. Пустой
`amount` на put dump считает **1**. Цель `request` должна быть online
(`getByNick` + session presence); нет в сети / нет героя → `игрок не в сети`.

Сессия:

```
{
  status: 100,
  confirm_key: string,
  my_tray / opponent_tray,   // opponent_tray: [] до confirm инвайтее
  bag: { [id]: Artifact },   // map, не массив
  money: number              // серебро героя, gold number
}
```

Тарелка: `{ id, nick, confirmed, tax, items }` — пустой `items` = `[]`, иначе
`{ artifacts?: { [id]: Artifact }, money?: number }`. Закрытая сессия:
`{ status: 100 }`. Settle дополнительно `user|magic` + `user|bag` (HTTP и esrv
партнёру).

`user|magic` в текущем срезе — пустые gloves (как bootstrap).
