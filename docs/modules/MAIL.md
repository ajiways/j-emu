# Mail (MAIL-01)

## Статус

Inbox/outbox, welcome, plain send/delete и `user|bag_order` реализованы на
raw-AMF. CEF почты не прогонялся — product-status **готово** не ставить.
Точный product-status: [CAPABILITIES.md](../CAPABILITIES.md).

## Источники поведения

- `jgr-emu/docs/MAIL.md`;
- `jgr-emu/src/mail/` (`index.ts`, `letters.ts`, `wire.ts`, `tax.ts`,
  `unread.ts`);
- `jgr-emu/src/emotions.ts` `buildUserMacro` / `[[USER key]]`;
- `jgr-emu/src/routes/oa/user.ts` `user|bag_order`.

Не переносить attachments/COD/pick/retract/TTL sweep, system chat
`macroses`, кланы и catalog `welcome_message` (это bootstrap toast, не
письмо почтальона).

## Architecture decision

Отдельный `ARC-SOC` не нужен. Mailbox — модуль `mail` (`src/modules/mail`),
не target `social` и не `economy`. Деньги остаются `heroes.money_minor`
через character `debitMoney`. Inventory в MAIL-01 не участвует. Composition
UoW (`src/app/mail-send.ts`) атомарно списывает postage и пишет две строки
письма. Mail не пишет `heroes`. Character не пишет `mail.letters`.

Chat piggyback (`Вы отправили письмо…`) не имитировать: chat не перенесён.

Fight lock / ghost на `post|*` dump не ставит — не выдумывать.

IDs выдаёт PostgreSQL identity с `1`. Wire integer `1..2_147_483_647`.

## Welcome policy

Именованная `WELCOME_LETTER`, не catalog. Первый `post|list` на **пустой**
inbox кладёт системное письмо (`system=1`, `bypassCapacity`):

- from nick `Почтальон`, `peer_hero_id` null;
- subject `Добро пожаловать`;
- text dump-proven про 50 слотов и системные письма.

Пустой inbox после delete welcome → следующее `list` создаёт письмо снова
(dump `countInbox === 0`). Restart безопасен: строка в PostgreSQL.

Catalog `welcome_message` к почте не относится.

## Send (plain)

Только текст. Postage: **1 золотой** (`MAIL_POSTAGE`) + `mailTax(enclosed)`;
enclosed gold в MAIL-01 запрещён → tax 0. Списание `debitMoney` 100 minor.
`allowGhost: true` — dump ghost на send не гейтит.

Формула tax dump-proven: `round(0.5^(log10(v)+2) * v, 2)`; `v<=0` → 0.

Две строки: inbox получателя и outbox отправителя, даже при self-send.
`pair_id` обеих = id inbox-строки.

Ник получателя case-insensitive (`CharacterService.getByNick`).
`MIN_MAIL_LEVEL = 1`. Inbox cap **50** (system/welcome обходят).

## Delete

Только владелец строки (`owner_hero_id`). Письмо с valuables (`money_come` /
`payment` > 0) — 203 `сначала заберите ценности`. MAIL-01 valuables нет.

## Out of MAIL-01 (MAIL-02)

`post|send_cod`, `post|pick`, `post|batch_pick`, `post|retract`, вложения,
золото в письме, `artifacts_json`, TTL sweep/expiry worker.

## Schema (`mail`)

`mail.letters`:

- `id` integer GENERATED ALWAYS AS IDENTITY START 1;
- `owner_hero_id` FK `character.heroes` ON DELETE RESTRICT;
- `folder` `inbox|outbox`;
- `peer_hero_id` nullable FK heroes (null = система);
- `peer_nick`, `subject`, `body` text not null;
- `sent_at` / `expires_at` timestamptz (wire `stime`/`rtime` unix-sec);
- `flags` integer ≥ 0 (COD=1, ALREADY_READ=2, ITEM_RETURN=4; MAIL-01 пишет 0);
- `money_come_minor`, `payment_minor`, `tax_minor` bigint ≥ 0;
- `money_type` 0|1 (plain text → 0; gold UI → `"1"`);
- `pair_id` nullable; `system` 0|1.

TTL хранится (`inbox` 10 суток, `outbox` 30). Sweep — MAIL-02: list не
удаляет просроченное.

JSONB нет. `artifacts_json` появится в MAIL-02.

Unix time только в jugger-wire mapper.

## Public ports

Mail: `listInbox` (ensure welcome), `listOutbox`, `delete`, `hasUnread`,
`deliverPlayerPair`.

Character: `getByNick`, `getById`, `debitMoney`.

Composition `MailSend`: одна UoW на postage + две insert. Нехватка золота и
бизнес-отказы — typed `MailDeniedError` → wire **203**.

## Wire

| OA                | Форма                                                                 | Успех                                                                            |
| ----------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `post\|list`      | —                                                                     | nested `{ status:100, list, macros_list }`                                       |
| `post\|list_sent` | —                                                                     | то же, outbox, ник-поле `to_nick`                                                |
| `post\|send`      | `subject`, `text`, `nick`, `money`, `attachment`, `send_clan_members` | flat: `post\|send` `{status:100}` + `user\|bag` + `state`                        |
| `post\|delete`    | `id`                                                                  | flat: `post\|delete` + обновлённый `post\|list` / `list_sent` + bag + state      |
| `post\|read`      | —                                                                     | nested `{ status:100 }`                                                          |
| `user\|bag_order` | —                                                                     | flat: `{status:100}` + `user\|bag` + `state` (compose; dump не переставляет bag) |

Пустые `list` / `macros_list` = **`[]`**. Непустой `list` = объект **id →
letter**. `artifact_list` MAIL-01 всегда `[]`.

Ник: **`[[USER ${key}]]`**, не `#macros…##`. `macros_list[key]` =
`buildUserMacro` из **текущего** peer (`nick`/`level`/`kind`). Поля `id`
нет. `rank` dump-proven **0**, `server_id` **1**. Пустые clan-поля не слать.
Системное письмо: nick `Почтальон`, level 0, kind 0 — named
`SYSTEM_MAIL_PEER`, не fallback на missing hero. Если `peer_hero_id` задан,
герой обязан существовать.

Dump `post|list` **без** page-параметра: сервер отдаёт весь folder `id desc`.
Клиент пагинирует объект. Это и есть acceptance «paginated».

`state.new_message` = `1`, если во inbox есть строка без ALREADY_READ.
`post|read` флаг не ставит (unread у клиента в SharedObject). MAIL-01 не
пишет READ → любой непустой inbox даёт `new_message:1`. List сам `state` не
кладёт (dump nested payload).

Ошибки: **203** + `error`. `send_clan_members` → `кланы не поддерживаются`.
Вложения / enclosed gold → 203 (срез без pick). Не слать `error` на 100.

Незарегистрированные `post|pick` / `send_cod` / `retract` / `batch_pick` →
registry `… is not implemented`.
