# ADR-0020: Ephemeral active combat

- Статус: Accepted
- Дата: 2026-09-08
- Заменяет: ADR-0006, ADR-0015

## Решение

Active combat целиком живёт в process-local `CombatService`: participants, HP,
turns, effects, RNG state, queues и outbound packets. PostgreSQL не хранит
active fights, turns, effects, checkpoints, packets, leases или event log.

Restart прекращает незавершённый бой. Persistent hero/inventory/reward changes
применяются только атомарным terminal settlement, поэтому потеря процесса не
оставляет частично завершённый результат.

После terminal outcome PostgreSQL получает одну best-effort
`finished_fights` history row:

- повтор идентичного результата идемпотентен;
- тот же fight ID с другим результатом — диагностируемый conflict;
- ошибка history не отменяет terminal packets/rewards;
- retention — 72 часа;
- cleanup выполняется bounded single-flight batches вне request path.

History не является source of truth для rewards, quests или statistics.
Fight/result ID выдаёт PostgreSQL sequence с `1`; human participant ID равен
`heroes.id`; bot participant ID ephemeral от `1_000_000`.

## Последствия

- Удары и polls не создают DB RPS.
- Reconnect active fight возможен только пока жив process-owner; multi-process
  deployment требует sticky routing.
- Требование переживать restart потребует нового hot-state решения; active
  combat tables заранее не создаются.
