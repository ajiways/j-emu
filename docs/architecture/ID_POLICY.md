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

Канон распределения ID:
[jgr-emu docs/ID_RANGES.md](../../../jgr-emu/docs/ID_RANGES.md).
Клиент не требует искусственных префиксов: крупные live ID — накопившийся
auto-increment, а не MINVALUE.

Общий persistent default:

- identity/sequence начинается с **1**;
- `NO CYCLE`;
- исчерпание является ошибкой;
- wire integer находится в диапазоне **1..2 147 483 647**.

Единственное подтверждённое исключение к старту с 1:

- `inventory.item_instance` (`items.id`) начинается с **100 000** и имеет
  `MAXVALUE 2 147 483 647`, `NO CYCLE`;
- клиент матчит `persSpells.srcId == items.id` без `srcType`, поэтому ID
  экземпляра не должен совпасть с native `1/2/3/5/6/7/10` или artikul
  надетой перчатки;
- исторический floor `1e9` не является контрактом.

Combat:

- `combat.fight` / `finished_fights.id` выдаёт PostgreSQL с **1**;
- human participant ID равен numeric `heroes.id` и отдельно не выдаётся;
- fight bot ID является ephemeral combat state: RAM counter начинается с
  **1 000 000**, уникален внутри одного `persList` и не сохраняется;
- floors `900 001`, `100 000`, `200 000`, `10M+hero` и `90 000 001` не
  являются допустимыми альтернативами.

Остальные специальные правила:

- `0` запрещён, кроме `answer_id=0` (доска) и `instance_id=0` (мир);
- quest point/answer и dungeon/BG instance copies выдаются с **1**;
- `book_id` сохраняет подтверждённый номер, а не занимает чужой ID;
- map hunt ID равен `area × 100 + index`;
- dungeon hunt ID уникален в том же `common|hunt` относительно карты;
- BG и dungeon copies различаются типом, а не искусственным floor.

Неизвестный namespace нельзя занимать «на будущее», вычислять по соседнему
диапазону или снабжать fallback.

## Authored content

ID authored content задаются в исходном контенте и сохраняются при импорте.
Importer проверяет тип, допустимость, уникальность и ссылки, но не
перенумеровывает ID.

Runtime-сущности, созданные по authored content, получают собственный ID от
БД. ID определения контента хранится отдельно как ссылка и не используется
как ID runtime-сущности.

## Текущий playable slice

После `0000_foundation_init`:

- `accounts.id` / `heroes.id` — PostgreSQL `integer GENERATED ALWAYS AS IDENTITY`
  с `1`; `heroes.id` одновременно human participant ID на wire;
- `items.id` — `inventory.item_id_seq` `MINVALUE 100000` `MAXVALUE 2147483647`
  `NO CYCLE`;
- `finished_fights.id` — `combat.fight_id_seq` с `1`, тот же потолок, `NO CYCLE`;
- persisted human participant sequence нет;
- fight bot ID — process-local counter с `1_000_000`, не сохраняется;
- catalog `artikul_id` остаётся authored и не перенумеровывается;
- session secret — application-generated token, не persisted aggregate ID.

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
[ADR-0016](../adr/ADR-0016-live-derived-id-allocation.md).
