# Quest engine: transition engine specification v1

> **Статус:** нормативный алгоритм для QE-01–QE-03. Engine является pure
> function: он не читает БД, clock, RNG, catalogs или services.

## Input и output

```ts
type TransitionInput = Readonly<{
  definition: CompiledQuestDefinitionV1;
  run: RunSnapshot;
  input: QuestInput;
  evaluation: QuestEvaluationSnapshot;
  persistedDecisions: readonly DecisionSnapshot[];
}>;

type TransitionResult = Readonly<{
  runPatch: RunPatch;
  stageWrites: readonly StageWrite[];
  requirementWrites: readonly RequirementWrite[];
  decisions: readonly DecisionWrite[];
  effects: readonly PlannedEffect[];
  operations: readonly OperationIntent[];
  history?: RunHistoryWrite;
  dirty: readonly ProjectionKey[];
  audit: readonly TransitionAuditEntry[];
}>;
```

Input содержит полностью resolved snapshot. Result — план, а не выполненная
mutation. Application layer проверяет operation keys, вызывает effect ports и
сохраняет весь result одной UoW.

## Quest inputs

```ts
type QuestInput =
  | { type: "accept"; commandId: string }
  | { type: "cancel"; commandId: string; expectedRevision: number }
  | { type: "event"; event: QuestEvent }
  | {
      type: "select_choice";
      commandId: string;
      node: NodeKey;
      option: SemanticKey;
      expectedRevision: number;
    }
  | {
      type: "claim_reward";
      commandId: string;
      node: NodeKey;
      package?: SemanticKey;
      expectedRevision: number;
    };
```

Dialog runtime преобразует committed semantic answer в один из этих inputs или
в обычный effect plan. Wire напрямую `select_choice`/`claim_reward` не создаёт.

## Run state

```ts
type RunStatus = "active" | "ready" | "completed" | "cancelled" | "failed";

type RunSnapshot = Readonly<{
  runId: string;
  heroId: number;
  questKey: QuestKey;
  releaseId: string;
  status: RunStatus;
  revision: number;
  activeStage?: Readonly<{ node: NodeKey; activation: number }>;
  control: readonly ControlFrame[];
  facts: Readonly<Record<SemanticKey, FactValue>>;
  progress: readonly RequirementProgressSnapshot[];
}>;
```

`activeStage` отсутствует только у terminal run либо на мгновение внутри pure
closure. Persisted non-terminal run всегда имеет один stable active stage.

`activation` монотонно увеличивается при каждом повторном входе в тот же node.
Все progress, decisions, waits и encounters bind-ятся к `(node, activation)`.

## Общий алгоритм

```text
transition(input):
  assert definition identity == run pinned identity
  assert input allowed by run status and expected revision
  create empty plan with nextRevision = run.revision + 1

  if accept:
    enter graph.entry
  if event:
    apply event to every interested requirement of active stage
    if stage completion changed false -> true: complete active stage
  if select_choice:
    persist decision, close choice stage, enter selected edge
  if claim_reward:
    persist selection/claim, plan package effects, close reward stage
  if cancel:
    create cancellation plan and terminal history

  run closure until stable stage or terminal
  assert exactly one stable stage for non-terminal result
  return deterministic plan
```

No-op event возвращает audit/disposition `ignored` и не увеличивает run
revision. Applied event, даже если он изменил progress без завершения stage,
увеличивает revision ровно один раз.

## Accept

Facade до engine проверяет availability и отсутствие active run. Engine:

1. создаёт run snapshot, attempt/cycle уже назначены application layer;
2. входит в graph entry;
3. выполняет instantaneous closure;
4. активирует первый stable stage;
5. планирует только его `onActivate` effects;
6. публикует journal/board/world dirty keys.

Accept и effects атомарны. Ошибка effect port означает отсутствие run.

## Event application

Router уже выбрал run по interest index. Engine повторно проверяет:

- status active/ready допускает kind;
- event context и requirement generation совпадают;
- requirement handler действительно интересуется kind;
- party credit decision передан в evaluation context.

Все matching requirements получают один и тот же pre-event snapshot и затем
merge-ятся по уникальному requirement key. Requirement не может читать mutation
соседнего requirement. Благодаря этому порядок массива не влияет на результат.

После merge completion rule вычисляется один раз. `ordered` является
исключением: interpreter передаёт persisted expected key и обрабатывает facts в
canonical event payload order; один event не может тайно перескочить несколько
шагов, если payload contract это явно не разрешает.

## Stage completion

При переходе objective из incomplete в complete:

1. зафиксировать final progress;
2. отметить stage instance `completed` с journal snapshot;
3. спланировать `onComplete` effects в authored order;
4. перейти к `next`;
5. выполнить graph closure;
6. активировать следующий stable stage и его `onActivate` effects.

Effects не могут отменить уже вычисленный completion в этой transition. Если
effect меняет condition следующего gate, новый evaluation result должен быть
получен детерминированно из planned overlay либо transition делится application
layer на последовательные внутренние facts. Скрытый repository reread внутри
engine запрещён.

## Graph closure

Closure обрабатывает control nodes до stable stage:

- `gate`: первый true case по authored order; иначе `otherwise`, отсутствие —
  runtime invariant violation, которое должен был поймать compiler;
- `sequence`: push frame с remaining nodes, перейти в первый; completion child
  возвращается в frame, затем в следующий/`next`;
- `bounded_repeat`: создать/increment iteration frame, войти в body либо `next`;
- `end`: применить terminal effects, создать history и terminal status;
- `objective`, `choice`, `reward`: остановить closure и активировать stage.

Каждый instantaneous hop уменьшает compiler-proven termination budget. Runtime
также имеет hard hop limit; достижение означает invariant error и полный
rollback, а не частично сохранённый run.

## Choice

`select_choice` допустим, только если:

- active stage совпадает с node/activation session;
- option существует и condition true в том же locked snapshot;
- для этой activation нет persisted decision;
- command expected revision совпадает.

Decision записывается до branch effects. Повтор того же command id возвращает
сохранённый semantic result; другой option после commit получает
`quest_choice_already_committed`.

## Reward

Reward stage становится `ready`, а не completed. Claim:

- `all`: package field отсутствует, все packages планируются один раз;
- `choose_one`: package обязателен, существует и доступен;
- effect operation key выводится из run/node/activation/package/effect key;
- все DB rewards и terminal history commit-ятся вместе;
- external presentation operations могут выполниться после commit.

Полный inventory не блокирует обычный quest reward: inventory port применяет
оговорённый overflow policy. Ошибка catalog/policy не превращается в completed
run.

## Cancellation

Cancellation planner получает asset/session/wait/encounter ownership snapshot.
Engine закрывает active stage как `cancelled`, создаёт terminal status/history и
typed cleanup plans. Permanent facts/rewards отсутствуют в cleanup set.

Если encounter policy `deny_while_active`, command отклоняется до mutation. При
`abandon` encounter closure и run cancellation входят в одну DB transition, а
RAM cleanup становится durable operation.

## Operation keys

Canonical key components:

```text
runId / nodeKey / activation / transitionKind / effectKey / occurrence
```

Key строится structured encoder-ом, а не конкатенацией без escaping. Один
authored effect key может появиться повторно только с другой activation либо
occurrence, разрешённой node semantics.

## Planned overlay

Для closure после transactional effects engine поддерживает ограниченный
typed overlay:

- run/world facts;
- money/reputation deltas;
- inventory grant/consume lots;
- profession/entitlement changes.

Condition handlers объявляют dependencies. Если effect меняет dependency,
overlay evaluator видит planned value. Capability без overlay support не может
участвовать в том же instantaneous gate: compiler требует отдельный stable
stage/event boundary.

## Deterministic ordering

- heroes: ascending id;
- runs: ascending internal id;
- requirements: semantic key;
- effects: authored array order, operation key as tie breaker;
- derived facts: effect order затем fact ordinal;
- dirty projection keys: fixed enum order.

Порядок нужен для воспроизводимого audit и locks, но не должен менять semantic
result commutative requirements.

## Invariant errors против denials

Denial — ожидаемый command result: stale revision, unavailable option, wrong
stage, cancellation forbidden. State не меняется.

Invariant error — опубликованный snapshot или handler нарушает доказанный
contract: missing node, incompatible progress payload, closure loop, duplicate
effect key. UoW откатывается, release/run помечается в observability, ответ не
маскируется как denial или success.

## Обязательные model/property tests

- один stable stage либо terminal после каждой transition;
- duplicate input id даёт тот же result без новых writes;
- commutative event permutations дают одинаковый snapshot;
- activation generation изолирует старые events/decisions;
- reward/cancel никогда не наблюдаются частично;
- closure всегда завершается в compiler budget;
- каждый planned effect имеет уникальный operation key;
- replay audit inputs из initial snapshot воспроизводит final semantic state.
