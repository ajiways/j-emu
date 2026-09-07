# ADR-0015: Активный бой в памяти, в PostgreSQL только завершённая история

- Статус: Accepted
- Дата: 2026-09-07
- Заменяет: [ADR-0006](ADR-0006-combat-runtime-seam.md)

## Контекст

Старый `jgr-emu` не сохраняет активные ходы, эффекты или event log боя.
`FightSession` живёт в памяти процесса. После завершения
`recordFinishedFight()` записывает одну строку `finished_fights`, которую
используют:

- `arena|finished_fights`;
- HTML-страница информации о завершённом бое;
- необязательный account-scoped history query.

Старая строка содержит `id`, владельца, заголовок и тип боя, timeout, диапазон
уровней, `ml_title`, победителя, время начала, duration, wire-compatible teams,
локацию и время завершения. Активные бои для `arena|runned_fights` читаются
не из PostgreSQL, а из process-local registry.

Старый runtime удаляет историю по `finished_at`, но делает prune на write/read
path и имеет неявный default retention 7 дней. В `j-emu` это нельзя переносить:
retention установлен продуктовым решением в 72 часа, а request path не должен
получать дополнительную cleanup-нагрузку.

## Решение

Активный бой целиком принадлежит process-local `CombatService`:

- участники, HP, очередь ходов, эффекты, RNG state и outbound packets;
- reconnect работает, пока жив процесс-владелец;
- restart прекращает незавершённый бой;
- persistent hero/inventory/reward changes применяются только при terminal
  settlement, поэтому потеря процесса не оставляет частично применённый бой.

PostgreSQL не хранит active fight, participant state, commands, turns,
checkpoints, packets, effects, leases или event log.

После terminal outcome записывается одна идемпотентная строка завершённой
истории. Её контракт берётся из `jgr-emu.finished_fights`, а не проектируется
заново. Допустимы только storage-нормализации без изменения wire:

- `teams_json` → validated PostgreSQL `jsonb` с тем же teams DTO;
- unix-ms `finished_at` → `timestamptz`;
- numeric duration/winner/type хранятся числовыми типами;
- добавляются индексы под подтверждённые запросы по area/account и
  `finished_at`;
- обязательные поля не получают DB/application defaults.

`arena|finished_fights` в текущем срезе не отдаётся. История хранит те же
поля, что старая строка: `id`, `title`, `type`, `timeout`, `level_min`,
`level_max`, `level`, `ml_title`, `winner`, `started`, `duration`, `teams`.
`teams.1[].id` — numeric `heroes.id`.

Повторная запись идентичного результата идемпотентна. Тот же fight ID с
другими данными — диагностируемая ошибка, а не молчаливый `ON CONFLICT DO
NOTHING`. Ошибка сохранения history не прерывает terminal combat packets:
это явная best-effort policy с логом. Cleanup:

- выполняется отдельной периодической задачей, не на finish/read request path;
- удаляет bounded batches по индексированному `finished_at`;
- single-flight: параллельный запуск не начинает второй DELETE;
- не влияет на rewards, quests или статистику: history не является их source
  of truth;
- не продлевает TTL при чтении.

После удаления history request честно сообщает отсутствие результата. Старые
записи не архивируются в другом storage.

## Последствия

- DB write-path боя — одна запись history при завершении плюс отдельный batch
  cleanup, без RPS от ударов и poll.
- Незавершённый бой не восстанавливается после restart.
- Горизонтальный runtime требует sticky routing процесса-владельца.
- Если позднее появится подтверждённое требование переживать restart, оно
  требует нового ADR и другого hot-state storage; PostgreSQL event log заранее
  не создаётся.
- Active fight, participant и event tables не являются частью целевой схемы;
  durable model — одна finished-history table.

## Источники

- `jgr-emu/src/fightHistory.ts`: `recordFinishedFight`,
  `buildArenaFinishedFights`, `pruneFinishedFights`;
- `jgr-emu/src/db/schema.ts`: `finishedFights`;
- `jgr-emu/src/info/models.ts`: `reconstructFiFromHistory`,
  `buildFightInfoModel`;
- `jgr-emu/src/fight/lifecycle.ts`: запись результата из `finishFight`.
