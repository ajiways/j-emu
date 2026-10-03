# Quest engine: durable operations, facts and waits v1

> **Статус:** обязательный runtime contract для внешних/RAM effects и времени.
> Process timers, callbacks и in-memory outbox не являются источником истины.

## Три очереди с разной семантикой

1. `quest_operations` — quest просит выполнить внешнее действие: начать бой,
   отправить presentation notification, вызвать service.
2. `game_fact_outbox` — owning subsystem надёжно публикует уже совершившийся
   domain fact: завершён бой, истёк предмет, закончилась покупка.
3. `quest_waits` — persisted deadline, который при наступлении создаёт event.

Их нельзя объединять одним полем `type/payload/status`: direction, ownership и
retry/reconciliation различаются.

## Quest operation

```text
quests.operations
  operation_key text PK
  owner_type/run_id/session_id/encounter_id
  kind text
  handler_version text
  payload jsonb
  payload_digest text
  state pending|claimed|succeeded|retryable|failed|cancelled
  available_at timestamptz
  lease_owner text nullable
  lease_until timestamptz nullable
  attempts integer
  result jsonb nullable
  last_error_code text nullable
  created_at/updated_at/finished_at
```

Claim transaction использует:

```sql
FOR UPDATE SKIP LOCKED
```

и меняет `pending|retryable → claimed` с lease. Expired claimed row снова
доступна. Executor обязан передавать `operation_key` owning subsystem как
idempotency key.

## State transitions

Допустимы:

```text
pending -> claimed
claimed -> succeeded
claimed -> retryable -> claimed
claimed -> failed
pending|retryable -> cancelled
claimed -> cancelled только через executor-specific reconciliation
```

Unknown kind/version → `failed`, никогда `succeeded`. Retry использует bounded
exponential backoff + jitter, но deterministic operation identity. Permanent
policy denial обычно failed; infrastructure timeout — retryable.

## Crash windows

### До external call

Lease истекает, другой worker повторяет operation.

### External call выполнен, result не сохранён

Owning subsystem распознаёт idempotency key и возвращает тот же result. Если он
этого не умеет, operation kind нельзя считать safely retryable: требуется query
reconciliation либо другой integration design.

### Result сохранён, notification потеряна

Domain state уже committed. UI перечитывает projection; optional wake можно
повторить, но он не является completion proof.

## Durable game fact outbox

Shared application/infrastructure table в новой schema `runtime`, не owned
quest schema:

```text
runtime.game_fact_outbox
  fact_id text PK
  kind text
  schema_version text
  payload jsonb
  payload_digest text
  occurred_at timestamptz
  state pending|claimed|delivered|failed
  lease/attempt/error fields
  producer_operation_id text
  causation_id text nullable
```

Producer пишет state mutation и fact row одной UoW. Consumer преобразует fact в
quest event и вызывает facade. После успешных quest receipts row становится
delivered. Если активных quest runs нет, delivery всё равно успешна.

Это закрывает crash gap текущего fight terminal observer: settlement не может
commit-иться без recoverable terminal fact.

Outbox — closed versioned union, не arbitrary event bus. Retention удаляет
delivered rows только после audit window; fact id никогда не переиспользуется.

## Quest wait

`Quest wait` здесь означает server-authoritative operation после уже принятой
команды. Клиентские поля dialog answer `waiting_time/title/picture/video`
исключены из этого aggregate: старый Flash задерживает отправку answer локально,
а cancel не посылает серверу ничего. Для них нет row, deadline worker или
completion event.

```text
quests.waits
  id bigint identity PK
  run_id/session_id
  wait_key text
  node_key/activation
  generation integer
  state scheduled|claimed|completed|cancelled
  started_at timestamptz
  due_at timestamptz
  lease_owner/lease_until
  presentation_snapshot jsonb
  completion_event_id text unique
  completion_operation_key text
```

Unique active `(owner, wait_key, generation)`. `due_at` вычисляется один раз из
injected clock и authored duration, затем не пересчитывается из duration.

## Starting wait

В одной quest transition:

1. выбрать interaction outcome;
2. применить `consume_on_start` либо создать inventory reservation;
3. создать wait row и presentation snapshot;
4. сохранить run/session checkpoint;
5. commit;
6. отправить wake/projection.

Клиент получает `serverNow`, `startedAt`, `dueAt` и authored presentation. Его
таймер визуален; client `action_finish` не является доказательством истечения.

## Completing wait

Worker либо request-time catch-up:

1. lock hero/run/wait;
2. проверить `state=scheduled` и `dueAt <= now`;
3. сформировать deterministic `quest.wait_elapsed` id из wait/generation;
4. применить event/transition;
5. выполнить consume-on-success/release reservation;
6. пометить completed;
7. commit.

Параллельные worker/request видят receipt/state и возвращают один result.

## Cancel/interrupt

Authored policy определяет:

- можно ли interrupt;
- release reservation/refund;
- сохранять ли consume-on-start;
- сообщение/return screen;
- branch/reset/cancel run.

Run cancellation всегда закрывает scheduled waits. Completion и cancellation
сериализуются hero/run/wait locks; winner задаёт единственный terminal state.

## Time and downtime

После restart все overdue waits доступны worker-у. Семантика baseline:

- elapsed wall-clock считается даже при downtime;
- request-time catch-up завершает wait до выдачи stale projection;
- massive backlog обрабатывается batches, но один герой сериализован;
- изменение authored duration новой release не меняет существующий `dueAt`.

Paused/offline-only timers являются отдельной будущей capability и не
эмулируются обновлением timestamps при login.

## Presentation operations

`show_message`/refresh/wake могут быть:

- durable, если сообщение должно быть показано хотя бы один раз;
- best-effort post-commit, если projection полностью отражает результат.

Каждый effect явно выбирает delivery class. Durable notification хранит
semantic content + surface intent, не готовый response-local macro hash.

## Worker safety

- bounded batch/lease/attempts;
- heartbeat только для executor, который реально может долго работать;
- no lock during slow network/RAM operation;
- claim commit до external call;
- complete/retry отдельной transaction с compare claimed lease owner;
- metrics по age, attempts, failed, expired leases;
- graceful shutdown прекращает claims и оставляет lease recoverable.

## Tests с fault injection

- crash до/после claim;
- crash после external side effect до result save;
- duplicate worker;
- lease expiry и stale worker completion;
- outbox producer rollback;
- fact delivered без candidate runs;
- wait completion против cancel/interaction retry;
- downtime catch-up;
- wall clock/DST для authored time windows, absolute dueAt для wait;
- durable notification retry и best-effort wake loss;
- poison unknown handler/version fail-fast.
