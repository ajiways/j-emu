# Mail (MAIL-02)

## Статус

Inbox/outbox, welcome, send (текст / золото / вложения / НП), pick /
batch-pick, retract, delete, TTL sweep и `user|bag_order` реализованы на
raw-AMF. CEF почты не прогонялся — product-status **готово** не ставить.
Точный product-status: [CAPABILITIES.md](../CAPABILITIES.md).

## Источники поведения

- `jgr-emu/docs/MAIL.md`;
- `jgr-emu/src/mail/` (`index.ts`, `letters.ts`, `wire.ts`, `tax.ts`,
  `sweep.ts`, `unread.ts`);
- `jgr-emu/src/emotions.ts` `buildUserMacro` / `[[USER key]]`;
- `jgr-emu/src/routes/oa/user.ts` `user|bag_order`.

Не переносить catalog `welcome_message` (bootstrap toast, не письмо
почтальона), system chat `macroses` и кланы.

## Architecture decision

Отдельный `ARC-SOC` не нужен. Mailbox — модуль `mail` (`src/modules/mail`),
не target `social` и не `economy`.

Владение:

- `mail` пишет только `mail.letters` и `mail.letter_attachments`;
- деньги — `heroes.money_minor` через character `debitMoney` / `creditMoney`;
- bag — inventory take-by-instance / snapshot grant.

Composition UoW атомарно списывает bag+золото и пишет пару писем (send),
забирает вложения (pick / batch-pick) и возвращает НП (retract / expiry).
Mail не пишет `heroes` и `inventory.items`. Inventory не пишет `mail.*`.
Character не пишет `mail.*`.

Chat piggyback (`Вы отправили письмо…`) не имитировать: chat не перенесён.

Fight lock / ghost на `post|*` dump не ставит — не выдумывать. `allowGhost:
true` на postage/debit.

IDs писем выдаёт PostgreSQL identity с `1`. Wire integer `1..2_147_483_647`.
Instance `items.id` после pick **новый** (dump `grantMailArtifact`).

## Вложения: snapshot, не reservation

Dump хранит AMF JSONB `artifacts_json` и уничтожает bag-строку. Target
`social` «reservation/reference» — план, не runtime.

**Решение MAIL-02:** дочерняя таблица `mail.letter_attachments` — снимок
`original_item_id`, `artifact_id`, qty, durability, upgrade и instance
`data_json` (как `inventory.items.data_json`: `{}` или rolled glove).
Dump AMF `artifacts_json` нет. Живой `items` row в письме не держим и
`location_kind: mail` не добавляем.

Send берёт bag **по `items.id`** (клиентский map id→qty), не по catalog
`artikul_id` (это ECO-02 barter). Max **5**. Только bag. NOGIVE (`flags &
32` каталога или bound upgrade) → 203 `непередаваемый предмет нельзя
отправить почтой`.

Pick восстанавливает снимок через inventory grant: durability/upgrade/`data_json`
снимка обязательны, молча подставлять каталожный шаблон нельзя. Новые
instance id — dump-совместимо.

Гонка pick/retract/sweep: `SELECT FOR UPDATE` строки письма в той же UoW.
Один победитель; проигравший видит уже пустое/удалённое письмо. Rollback
UoW возвращает bag и золото, dump-стиль «grant back» не нужен.

Просроченное обычное письмо **сжигает** вложения вместе со строкой. НП
inbox с вложениями → системный возврат отправителю (`ITEM_RETURN`),
`bypassCapacity`. Sweep: на `list` / `list_sent` / send / pick / delete /
retract **и** process `DelayScheduler` ~30с (как hunt wander), не
отдельный worker. Chat не будить.

## Welcome policy

Именованная `WELCOME_LETTER`, не catalog. Первый `post|list` на **пустой**
inbox кладёт системное письмо (`system=1`, `bypassCapacity`):

- from nick `Почтальон`, `peer_hero_id` null;
- subject `Добро пожаловать`;
- text dump-proven про 50 слотов и системные письма.

Пустой inbox после delete welcome → следующее `list` создаёт письмо снова
(dump `countInbox === 0`). Restart безопасен: строка в PostgreSQL.

## Send

Ник case-insensitive. `MIN_MAIL_LEVEL = 1`. Inbox cap **50** (system /
welcome / оплата и возврат НП обходят).

Обычная отправка: postage **1 золотой** + `mailTax(money + sum(price*qty))`.
Enclosed gold списывается у отправителя и кладётся в `money_come`.
Формула tax dump-proven: `round(0.5^(log10(v)+2) * v, 2)`; `v<=0` → 0.
Хранение — minor (2 знака золота), не unrounded float dump-строки.

НП (`post|send_cod`): вложения обязательны, `money` = цена выкупа > 0.
Postage 1g нет. Отправитель платит `mailTax(itemValue, true)` (×1.5). На
письме `tax` — **немасштабированная** база `mailTax(itemValue, false)`;
получатель при pick платит `payment+tax`. `flags|=COD`. TTL обеих копий
**1 сутки**.

Две строки: inbox получателя и outbox отправителя, даже при self-send.
`pair_id` обеих = id inbox-строки. Снимок вложений копируется на обе
строки.

## Pick / retract / delete

`post|pick`: только inbox. НП — списать `payment+tax`, выдать вложения,
отправителю системное inbox «Оплата наложенного платежа» с `money_come`
(золото не credитить напрямую). `delete=1` удаляет строку, иначе
`markPicked` (снять COD, поставить READ, обнулить valuables и вложения).
Переполнение бага → 203 `в рюкзаке нет места`, письмо не трогать.

`post|batch_pick`: только не-НП, всё или ничего, всегда с удалением.

`post|retract`: кнопка «Вернуть» на **входящем** НП, не отмена outbox.

`post|delete`: только владелец; valuables (`money_come` / `payment` /
вложения) → 203 `сначала заберите ценности`.

## Schema (`mail`)

`mail.letters` — MAIL-01 плюс те же money/flags. TTL: inbox 10 суток,
outbox 30, pending COD 1 сутки.

`mail.letter_attachments`: PK `(letter_id, ord)`; FK letter ON DELETE
CASCADE; нет FK на `inventory.items` (инстанс уже уничтожен);
`data_json` jsonb NOT NULL — копия instance extra.

Unix time только в jugger-wire mapper.

## Public ports

Mail: `listInbox` / `listOutbox` (sweep + welcome), `delete`, `hasUnread`,
`deliverPlayerPair`, `lockInbox`, `markPicked`, `deliverSystemInbox`,
`returnCodInbox`, `sweepExpired`.

Inventory: `takeFromBagForMail` (instance id), `canFitMailSnapshots`,
`grantMailSnapshots`.

Character: `getByNick`, `getById`, `lockById`, `debitMoney`.

Composition: `MailSend`, `MailClaim`, `MailTtlSweep` на общем
`DelayScheduler`.

## Wire

| OA                 | Форма                                                                 | Успех                                                                              |
| ------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `post\|list`       | —                                                                     | nested `{ status:100, list, macros_list }`                                         |
| `post\|list_sent`  | —                                                                     | то же, outbox, ник-поле `to_nick`                                                  |
| `post\|send`       | `subject`, `text`, `nick`, `money`, `attachment`, `send_clan_members` | flat: `post\|send` `{status:100}` + `user\|bag` + `state`                          |
| `post\|send_cod`   | как send; `money` = выкуп; вложения обязательны                       | flat: `post\|send_cod` + bag + state                                               |
| `post\|pick`       | `id`, `delete` `0`/`1`                                                | flat: `post\|pick` + `post\|list` + bag + state; при `delete=1` ещё `post\|delete` |
| `post\|batch_pick` | `ids[]`                                                               | flat: `post\|batch_pick` + `post\|list` + bag + state                              |
| `post\|delete`     | `id`                                                                  | flat: `post\|delete` + обновлённый `post\|list` / `list_sent` + bag + state        |
| `post\|retract`    | `id`                                                                  | flat: `post\|retract` + `post\|list` + bag + state                                 |
| `post\|read`       | —                                                                     | nested `{ status:100 }`                                                            |
| `user\|bag_order`  | —                                                                     | flat: `{status:100}` + `user\|bag` + `state` (compose; dump не переставляет bag)   |

Пустые `list` / `macros_list` / `artifact_list` = **`[]`**. Непустой `list`
= объект **id → letter**. Непустой `artifact_list` = объект (bag-шейп,
ключ — `original_item_id` снимка).

Ник: **`[[USER ${key}]]`**, не `#macros…##`. `macros_list[key]` =
`buildUserMacro` из **текущего** peer (`nick`/`level`/`kind`). Поля `id`
нет. `rank` dump-proven **0**, `server_id` **1**. Пустые clan-поля не слать.
Системное письмо: nick `Почтальон`, level 0, kind 0 — named
`SYSTEM_MAIL_PEER`. Если `peer_hero_id` задан, герой обязан существовать.

Dump `post|list` **без** page-параметра: сервер отдаёт весь folder `id desc`.

`state.new_message` = `1`, если во inbox есть строка без ALREADY_READ.
`post|read` флаг не ставит.

`money_type` = `"1"` при COD / valuables / tax / вложениях, иначе `"0"`.

Ошибки: **203** + `error`. `send_clan_members` → `кланы не поддерживаются`.
Не слать `error` на 100.
