# Quest engine: application API and errors v1

> **Статус:** целевая публичная граница модуля. Это semantic API; HTTP/OA/AMF
> adapters преобразуют его результаты, но не добавляют business rules.

## Facade groups

```ts
interface QuestApplicationFacade {
  readonly commands: QuestCommands;
  readonly events: QuestEvents;
  readonly queries: QuestQueries;
  readonly workers: QuestWorkers;
  readonly publication: QuestPublicationGuard;
}
```

Все mutation методы получают caller-provided `operationId`. Application facade
не генерирует новый id после начала mutation/retry path.

## Commands

```ts
interface QuestCommands {
  accept(input: AcceptQuestCommand): Promise<QuestCommandResult>;
  cancel(input: CancelQuestCommand): Promise<QuestCommandResult>;
  chooseDialogAnswer(input: ChooseDialogAnswerCommand): Promise<DialogCommandResult>;
  closeDialog(input: CloseDialogCommand): Promise<DialogCommandResult>;
  selectReward(input: SelectRewardCommand): Promise<QuestCommandResult>;
  beginInteraction(input: BeginInteractionCommand): Promise<InteractionResult>;
  finishInteraction(input: FinishInteractionCommand): Promise<InteractionResult>;
}

type CommandBase = Readonly<{
  operationId: string;
  heroId: number;
  expectedHeroRevision?: number;
}>;

type AcceptQuestCommand = CommandBase & {
  questKey: QuestKey;
  entryKey: SemanticKey;
  host: HostRef;
};

type CancelQuestCommand = CommandBase & {
  runId: string;
  expectedRunRevision: number;
};

type ChooseDialogAnswerCommand = CommandBase & {
  sessionId: string;
  nodeKey: SemanticKey;
  answerKey: SemanticKey;
  expectedSessionRevision: number;
};

type SelectRewardCommand = CommandBase & {
  runId: string;
  nodeKey: NodeKey;
  packageKey?: SemanticKey;
  expectedRunRevision: number;
};
```

`questKey`/entry/host из клиента не авторизуют действие. Facade заново resolve-ит
visible entry из locked snapshot. `runId` внутренний и обычно находится adapter
по client book/point identity; принимать его из legacy wire необязательно.

## Events

```ts
interface QuestEvents {
  apply(event: QuestEvent): Promise<QuestEventResult>;
}

type QuestEventResult = Readonly<{
  eventId: string;
  dispositions: readonly Readonly<{
    heroId: number;
    runId: string;
    outcome: "applied" | "ignored" | "duplicate";
    reason?: string;
    resultingRevision: number;
  }>[];
  dirtyHeroes: readonly number[];
}>;
```

Успешный result не означает, что event обязательно продвинул квест. Absence
candidate runs даёт пустой dispositions и считается валидной доставкой.

## Queries

```ts
interface QuestQueries {
  interactionBoard(input: BoardQuery): Promise<InteractionBoardProjection>;
  dialog(input: DialogQuery): Promise<DialogProjection>;
  journal(input: HeroQuery): Promise<QuestJournalProjection>;
  tracker(input: HeroQuery): Promise<QuestTrackerProjection>;
  worldOverlay(input: WorldOverlayQuery): Promise<QuestWorldOverlay>;
  availability(input: AvailabilityQuery): Promise<QuestAvailabilityProjection>;
}
```

Queries side-effect free: открытие board/dialog не создаёт run, session или RNG
decision. Исключение — explicit `openDialog` command, если scene требует
persisted session; query затем читает уже созданную session.

Каждая projection содержит monotonically increasing `projectionRevision` и
semantic identities. Wire adapter отдельно назначает response-local macro
dictionary/hash.

## Workers

```ts
interface QuestWorkers {
  claimOperations(input: {
    workerId: string;
    limit: number;
    leaseSec: number;
  }): Promise<ClaimedOperation[]>;
  completeOperation(input: CompleteOperation): Promise<void>;
  claimDueWaits(input: {
    workerId: string;
    now: Date;
    limit: number;
    leaseSec: number;
  }): Promise<ClaimedWait[]>;
  reconcileEncounters(input: { now: Date; limit: number }): Promise<ReconcileResult>;
}
```

Claim возвращает persisted payload + idempotency key. Worker не вызывает
private transition repositories напрямую: completion/facts возвращаются через
facade transaction.

## Publication guard

```ts
interface QuestPublicationGuard {
  inspect(input: {
    candidateReleaseId: string;
    activeReleaseId?: string;
  }): Promise<QuestImpactReport>;
  prepareActivation(input: {
    candidateReleaseId: string;
    policy: "reject_if_active" | "cancel_active_runs";
  }): Promise<ActivationPlan>;
}
```

QE-01 реализует только `reject_if_active`. `cancel_active_runs` появляется после
asset ledger/cancellation worker и не может быть заглушкой, возвращающей success.

## Result envelope

Expected denial возвращается typed result либо единым `QuestDeniedError`; проект
должен выбрать один стиль для facade и использовать его везде. Рекомендуемый
semantic result:

```ts
type QuestCommandResult<T = QuestMutationProjection> =
  | { ok: true; operationId: string; duplicate: boolean; value: T }
  | { ok: false; operationId: string; error: QuestError };

type QuestError = Readonly<{
  code: QuestErrorCode;
  retry: "never" | "same_operation" | "refresh_and_retry" | "later";
  safeDetails?: Readonly<Record<string, string | number | boolean>>;
}>;
```

Domain/application не содержит локализованный client text. Wire adapter
сопоставляет code с protocol block/chat/popup; authored wrong-context response
является успешным interaction outcome, а не error.

## Error codes

### Authorization/state denial

- `quest_not_available`;
- `quest_already_active`;
- `quest_not_active`;
- `quest_not_cancellable`;
- `quest_wrong_stage`;
- `quest_entry_not_available`;
- `quest_option_not_available`;
- `quest_choice_already_committed`;
- `quest_reward_not_ready`;
- `quest_reward_selection_required`;
- `quest_reward_selection_invalid`;
- `quest_dialog_session_closed`;
- `quest_interaction_not_available`.

### Concurrency/idempotency

- `quest_stale_revision` — refresh projection;
- `quest_operation_conflict` — тот же operation id с другим payload;
- `quest_event_conflict` — тот же event id с другим digest;
- `quest_operation_in_progress` — retry same operation/later;
- `quest_active_encounter`.

### Resource policy

- `quest_missing_required_asset`;
- `quest_payment_required`;
- `quest_profession_conflict`;
- `quest_effect_denied` с safe owning-service reason code.

### Internal invariant

- `quest_definition_unavailable`;
- `quest_handler_version_unavailable`;
- `quest_invariant_violation`;
- `quest_external_operation_failed`.

Internal codes логируются с correlation, но wire не получает stack/message/SQL.
Invariant failure никогда не возвращается как обычный authored denial.

## Idempotent command receipt

Для mutation command хранится:

```text
operation_id PK
hero_id
command_kind
canonical_input_digest
state: executing | succeeded | denied | failed
semantic_result jsonb
created_at / finished_at
```

В QE-01 receipt можно хранить в общей quest operations/command table. Повтор:

- same digest + succeeded/denied → вернуть сохранённый result;
- same digest + executing → `quest_operation_in_progress`;
- different digest → `quest_operation_conflict`;
- failed invariant не ретраится автоматически тем же command без явной policy.

Если legacy wire не несёт id, adapter создаёт id для одного server execution;
идемпотентность между двумя отдельными неразличимыми requests обеспечивается
state/decision constraints, а не command receipt.

## Locks и transaction ownership

Facade является владельцем UoW для command/event. Публичный порядок:

1. hero ids ascending;
2. party/membership rows;
3. command receipt;
4. runs ascending id;
5. sessions/waits/encounters;
6. owning resource rows через ports;
7. quest effect/event receipts.

Port не открывает независимую transaction, если facade уже находится в
`PostgresDatabase.run()`. Nested UoW обязана использовать тот же session.

## Direct-request security

Каждая mutation повторно проверяет:

- герой владеет run/session/item;
- release/revision/activation совпадают;
- host/area/instance доступны сейчас;
- entry/answer/option condition истинна;
- asset/payment/resource constraints истинны;
- operation payload соответствует command kind.

То, что board не прислал скрытую строку, не является security boundary.

## Adapter responsibilities

Wire adapter:

- decode primitive OA fields;
- resolve client numeric identity через stable wire registry;
- вызвать ровно один facade command/query;
- encode semantic projection/error;
- выполнить post-commit wake.

Wire adapter не читает quest tables, не вычисляет conditions, не выдаёт reward
и не запускает fight напрямую.
