# ADR-0016: Распределение ID по подтверждённому клиентскому контракту

- Статус: Superseded by [ADR-0018](ADR-0018-postgres-content-and-identifiers.md)
- Дата: 2026-09-07
- Заменяет: [ADR-0013](ADR-0013-database-generated-identifiers.md)

## Контекст

Первоначальная политика пыталась назначать отдельные крупные диапазоны для
разных wire namespaces. Research старого эмулятора, live dump и поведения
клиента показал, что это неверная модель:

- live использует обычные auto-increment ID без искусственных префиксов;
- каталог и экземпляр предмета различаются колонками, а не диапазоном;
- крупные live ID являются накопившимися значениями, а не стартовыми floors;
- отдельный безопасный floor нужен только экземплярам предметов из-за ошибки
  сопоставления `persSpells.srcId`;
- bot participant ID боя ephemeral и не является persisted entity.

Каноническое evidence:
[jgr-emu/docs/ID_RANGES.md](../../../jgr-emu/docs/ID_RANGES.md).

## Решение

Persistent identity/sequence в PostgreSQL начинается с `1`, если ниже не указано
подтверждённое исключение. Wire-visible integer не превышает
`2 147 483 647`.

Ноль на wire запрещён, кроме подтверждённых значений:

- `answer_id=0` для доски;
- `instance_id=0` для обычного мира.

Обязательные правила:

- `accounts`, `heroes`, party, mail, auction, `finished_fights.id`, dungeon/BG
  instance copies, quest point/answer/book ID выдаёт PostgreSQL с `1`;
- human participant ID в бою равен numeric `heroes.id`;
- экземпляр предмета `items.id` выдаёт PostgreSQL sequence с
  `MINVALUE 100_000`, `MAXVALUE 2_147_483_647`, `NO CYCLE`;
- `items.id` не совпадает с native spell IDs `1/2/3/5/6/7/10` и artikul
  надетой перчатки в одном `persSpells`;
- catalog `artikul_id` сохраняется из authored/live content и не выдаётся
  sequence экземпляров;
- fight bot ID создаётся только в RAM от `1_000_000`, уникален внутри одного
  `persList` и не сохраняется;
- map hunt ID вычисляется как `area × 100 + index`; dungeon hunt ID уникален в
  том же `common|hunt`;
- BG и dungeon copies различаются типом, а не искусственным ID floor;
- `book_id` сохраняет подтверждённый live номер и не занимает произвольный ID.

Запрещено переносить старые floors `1e9`, `920k`, `900001`,
`10_000_000 + hero`, `90_000_001` и `11e6` как контракт. Существующий
операционный START не объявляется допустимым переходным диапазоном: scaffold
мигрируется к правилам выше.

## Последствия

- Persisted hero ID numeric и пригоден для wire.
- Human participant не получает отдельный ID.
- Bot participant counter разрешён как ephemeral combat state и сбрасывается с
  процессом; это не генератор persisted ID.
- Fight ID результата выдаёт PostgreSQL и начинается с `1`.
- Item sequence начинается с `100_000`.
- Для каждой миграции обязательны clean-DB, collision, restart и raw-AMF tests.
