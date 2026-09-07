# Политика идентификаторов

## Постоянные сущности

ID новой постоянной сущности выдаёт Postgres:

- identity column;
- sequence;
- database default.

Persistence adapter создаёт строку через Drizzle и получает ID с помощью
`returning`. Приложение не вычисляет ID заранее.

Session secret, CSRF token, correlation ID и idempotency key не являются
идентификаторами persisted aggregate. Они могут создаваться криптографическим
генератором на application/edge-границе, а уникальность persisted row всё равно
обеспечивает PostgreSQL.

Запрещены:

- счётчик в памяти процесса;
- чтение `max(id)` и прибавление единицы;
- ID, вычисленный из другого ID;
- UUID, созданный приложением для постоянной сущности;
- повторное использование ID после удаления;
- cycling sequence.

## Совместимые числовые диапазоны

Реестр ведётся по wire namespace, а не как один глобальный числовой диапазон.
Например, `inventory.item_instance`, `npc.point`, `combat.fight` и
`combat.participant` считаются разными namespace только при наличии
клиентского доказательства, что их значения не сравниваются между собой.

Когда wire требует подтверждённый диапазон, для него создаётся отдельная
bounded, noncycling sequence Postgres. Для sequence обязательно задаются:

- владелец и тип сущности;
- подтверждённые `MINVALUE` и `MAXVALUE`;
- `NO CYCLE`;
- ошибка при исчерпании;
- миграция, создающая или изменяющая sequence.

Зарегистрированные namespaces:

- `inventory.item_instance`: **assigned** для текущего среза,
  `MINVALUE 1 000 000 000`, `MAXVALUE 2 147 483 647`, `NO CYCLE`. Floor
  подтверждён live/client наблюдениями, [описанием pocket wire](../../../jgr-emu/docs/POCKET.md),
  [старой константой](../../../jgr-emu/src/itemIds.ts) и
  [integer identity schema](../../../jgr-emu/src/db/schema.ts). Верхняя граница
  является явным ограничением server storage, а не утверждением о полном
  диапазоне live; raw-AMF E2E обязателен.
- `npc.point`: **unassigned**. Известен только legacy floor `920 000` из
  [`wireIds.ts`](../../../jgr-emu/src/wireIds.ts); max и collision scope не
  подтверждены.
- `combat.fight`: **unassigned**. `900 001` — начало старого process counter в
  [`fight/ids.ts`](../../../jgr-emu/src/fight/ids.ts), а не доказанный контракт.
- `combat.participant`: **unassigned**. Старый runtime использовал
  `10 000 000 + hero_id` для человека в
  [`fight/lifecycle.ts`](../../../jgr-emu/src/fight/lifecycle.ts) и counter от
  `90 000 001` для бота в
  [`fight/ids.ts`](../../../jgr-emu/src/fight/ids.ts). Арифметика и counter
  запрещены; непересекающиеся DB ranges ещё должны быть подтверждены.

`assigned` означает, что namespace можно реализовать строго указанной sequence.
`unassigned` блокирует создание соответствующего runtime ID: нельзя угадывать
max, collision scope или занимать соседний участок.

Неизвестный диапазон считается неназначенным. Нельзя угадывать его границы,
брать соседний свободный участок или добавлять fallback.

## Authored content

ID authored content задаются в исходном контенте и сохраняются при импорте.
Importer проверяет тип, допустимость, уникальность и ссылки, но не
перенумеровывает ID.

Runtime-сущности, созданные по authored content, получают собственный ID от
БД. ID определения контента хранится отдельно как ссылка и не используется
как ID runtime-сущности.

## Текущий playable slice

| ID                     | Postgres | Источник                                                                   | TypeScript                                                     | Wire                                    |
| ---------------------- | -------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------- |
| `identity.accounts.id` | uuid     | `gen_random_uuid()`                                                        | string                                                         | не клиентский hero id                   |
| `identity.sessions.id` | text     | crypto на application-границе                                              | string                                                         | `PHPSESSID`                             |
| `character.heroes.id`  | uuid     | `gen_random_uuid()`                                                        | string                                                         | `user\|conf.id`, `user\|unitframe.id`   |
| `inventory.items.id`   | bigint   | `inventory.item_id_seq` `MIN 1_000_000_000` `MAX 2_147_483_647` `NO CYCLE` | number после проверки диапазона                                | AMF number в `user\|bag`                |
| `combat.fight`         | bigint   | `combat.fight_id_seq` START 100000, `NO CYCLE`                             | decimal string                                                 | `fightId` string                        |
| `combat.participant`   | bigint   | `combat.participant_id_seq` START 200000, `NO CYCLE`                       | bigint; в AMF number только если значение в safe integer range | `userId` string, `srcId`/`dstId` number |
| artifact/bot id        | integer  | authored content                                                           | number                                                         | number                                  |
| area/spawn id          | text     | authored content                                                           | string                                                         | string                                  |

`inventory.item_instance` назначен и ограничен. Sequences боя текущего среза
выдают ID, чтобы playable hunt/fproxy работал; live floors `900 001` /
`10_000_000 + hero_id` по-прежнему **unassigned** и не подставляются.

Session secret не является persisted aggregate ID и остаётся
application-generated.

## Создание записи

Обычный поток:

1. application service передаёт данные repository;
2. repository выполняет Drizzle `insert`;
3. Postgres выдаёт ID;
4. Drizzle `returning` возвращает ID;
5. repository возвращает созданную сущность или типизированный ID.

Если ID не вернулся, создание завершается ошибкой. Пустое значение, локальный
fallback и повтор с вычисленным ID запрещены.

Основное решение:
[ADR-0013](../adr/ADR-0013-database-generated-identifiers.md).
