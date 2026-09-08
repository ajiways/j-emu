# Актуальные архитектурные решения

Для текущей реализации нужны четыре ADR:

1. [ADR-0017: runtime boundaries и fail-fast](ADR-0017-runtime-boundaries-and-fail-fast.md)
2. [ADR-0018: PostgreSQL, content и identifiers](ADR-0018-postgres-content-and-identifiers.md)
3. [ADR-0019: wire dispatch и acceptance](ADR-0019-wire-dispatch-and-acceptance.md)
4. [ADR-0020: ephemeral active combat](ADR-0020-ephemeral-combat.md)

ADR отвечает на вопрос «почему принято долгоживущее решение». Текущий
продуктовый статус находится в `docs/CAPABILITIES.md`, порядок переноса — в
`docs/migration/ROADMAP.md`, эксплуатационные команды — в runbooks.

## История

ADR-0001–ADR-0016 сохранены по прежним путям для ссылок и git history. Они
помечены `Superseded` и не являются основным маршрутом чтения.

Цепочки замены:

- 0001, 0002, 0003, 0004, 0008, 0009 → ADR-0017;
- 0005, 0010, 0011, 0013, 0016 → ADR-0018;
- 0007, 0012, 0014 → ADR-0019;
- 0006, 0015 → ADR-0020.

Исторические файлы физически не перемещаются, чтобы не ломать существующие
ссылки; этот раздел является их архивным индексом.

## Правило изменения

Accepted ADR не редактируется по существу. Новое решение создаёт следующий ADR
и помечает заменённый как `Superseded`.
