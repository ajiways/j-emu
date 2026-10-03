# Quest engine: authoring schema v1

> **Статус:** нормативный planning contract для первой реализации. Это ещё не
> готовая Zod schema, но implementation не должна менять форму молча: изменение
> требует новой `schemaVersion` или обновления этого документа.

## Граница документа

Author хранит декларативный JSON. Draft может быть невалидным, candidate и
release — только полностью валидными. Неизвестные поля, discriminators и enum
values являются ошибкой. `null` используется только там, где он явно указан;
отсутствие поля и `null` не считаются взаимозаменяемыми.

Runtime не принимает PostgreSQL ids, handler names, JS expressions, SQL,
wire flags или editor layout. Все ссылки используют semantic keys либо catalog
ids. Legacy wire ids назначает compiler через отдельный stable registry.

## Общие типы

```ts
type SemanticKey = string; // ^[a-z][a-z0-9_]{0,63}$
type QuestKey = SemanticKey;
type NodeKey = SemanticKey;
type SceneKey = SemanticKey;
type EffectKey = SemanticKey;
type RequirementKey = SemanticKey;

type RichContent = readonly RichFragment[]; // точная модель — RICH_CONTENT_AND_MACROS.md
type ConditionExpr =
  | { type: "all"; conditions: readonly ConditionExpr[] }
  | { type: "any"; conditions: readonly ConditionExpr[] }
  | { type: "not"; condition: ConditionExpr }
  | { type: "predicate"; predicate: ConditionSpec };
```

Пустой `all` означает true, пустой `any` — false. Вложенность condition tree,
число nodes/fragments и размер строк ограничиваются validator constants.

## Корень `QuestDefinitionV1`

```ts
type QuestDefinitionV1 = Readonly<{
  schemaVersion: "quest.v1";
  key: QuestKey;
  classification: readonly QuestClass[];
  presentation: QuestPresentation;
  availability: ConditionExpr;
  repeat: RepeatPolicy;
  party: PartyPolicy;
  cancellation: CancellationPolicy;
  entryPoints: readonly EntryPoint[];
  graph: QuestGraph;
  dialogs: Readonly<Record<SceneKey, DialogScene>>;
  rewards: Readonly<Record<SemanticKey, RewardPackage>>;
  encounters: Readonly<Record<SemanticKey, EncounterDefinition>>;
  interactions: Readonly<Record<SemanticKey, InteractionDefinition>>;
}>;
```

Каждая map key является identity объекта и не дублируется полем `id` внутри.
Порядок map keys семантики не имеет. Порядок массивов значим только там, где
это явно сказано (`answers`, `steps`, `members`, presentation order).

## Identity и presentation

`QuestClass` — presentation tags `normal | main | repeatable | group |
instance | exchange`. Они не определяют runtime semantics: cooldown задаёт
`repeat`, shared credit — `party`, обмен — requirements/effects.

```ts
type QuestPresentation = Readonly<{
  title: RichContent;
  bookSummary: RichContent;
  rewardPreview?: RichContent;
  levelHint?: { min?: number; max?: number };
  iconIntent?: "normal" | "main" | "repeatable" | "group" | "instance";
}>;
```

`levelHint` только показывается. Реальное ограничение уровня обязано находиться
в `availability`; compiler предупреждает о расхождении. Это не только новое
правило: preserved `reg_6lvl` показывает принятие героем уровня 5 квеста с
`level_min:7`, тогда как клиент использует поле для цвета board row.

## Availability, repeat, party и cancellation

```ts
type RepeatPolicy =
  | { type: "once" }
  | { type: "immediate" }
  | { type: "cooldown"; durationSec: number; anchor: "accepted" | "completed" | "reward_claimed" };

type PartyPolicy = Readonly<{
  defaultCredit: "personal" | "same_area" | "same_instance" | "participants";
  requireActiveRun: true;
  filters: readonly ("online" | "alive" | "participated")[];
  questLoot: "personal";
  reward: "personal";
}>;

type CancellationPolicy = Readonly<{
  allowed: boolean;
  cleanupTemporaryAssets: true;
  closeDialogs: true;
  closeWaits: true;
  encounter: "deny_while_active" | "abandon";
}>;
```

Permanent world facts и уже выданные terminal rewards отменой не откатываются.
Если квест должен позволять другой результат, он моделируется веткой до
terminal outcome, а не отменой.

## Entry points

```ts
type EntryPoint = Readonly<{
  key: SemanticKey;
  slot?: SemanticKey;
  host: HostRef;
  scene: SceneKey;
  when: ConditionExpr;
  priority: number;
  order: number;
  marker?: "offer" | "active" | "ready" | "none";
  label: RichContent;
}>;

type HostRef =
  | { type: "npc"; npcId: number }
  | { type: "item_catalog"; itemId: number }
  | { type: "item_instance"; selector: AssetSelector }
  | { type: "area_object"; areaId: number; objectKey: SemanticKey };
```

Несколько entry одного host могут быть видимы одновременно. `key` уникален в
definition. Если entries являются взаимоисключающими состояниями одной строки,
author задаёт им одинаковый `slot`, а validator доказывает deterministic winner
по conditions/priority. Недоступная entry не попадает в projection, но её
command всё равно проверяет `when`.

## Quest graph

```ts
type QuestGraph = Readonly<{
  entry: NodeKey;
  nodes: Readonly<Record<NodeKey, QuestNode>>;
}>;

type QuestNode =
  ObjectiveNode | ChoiceNode | GateNode | SequenceNode | BoundedRepeatNode | RewardNode | EndNode;
```

`objective`, `choice` и `reward` — stable player-facing stages. В один момент у
run активен ровно один такой stage. `gate`, `sequence` и repeat-control являются
instantaneous control nodes и закрываются interpreter-ом до fixed point.

```ts
type StagePresentation = Readonly<{
  description: RichContent;
  counters?: readonly CounterPresentation[];
  relatedWorld?: readonly WorldAffordance[];
}>;

type ObjectiveNode = Readonly<{
  type: "objective";
  journal: StagePresentation;
  requirements: readonly RequirementBinding[];
  completion: CompletionRule;
  onActivate?: readonly EffectRef[];
  onComplete?: readonly EffectRef[];
  next: NodeKey;
}>;

type RequirementBinding = Readonly<{
  key: RequirementKey;
  spec: RequirementSpec;
  credit?: PartyCreditOverride;
  optional?: boolean;
}>;

type CompletionRule =
  | { type: "all"; requirements: readonly RequirementKey[] }
  | { type: "any"; requirements: readonly RequirementKey[] }
  | { type: "at_least"; count: number; requirements: readonly RequirementKey[] }
  | { type: "ordered"; requirements: readonly RequirementKey[]; mismatch: "ignore" | "reset" };
```

Составная цель — один `ObjectiveNode` с несколькими requirements. Она не
создаёт несколько будущих/параллельных целей в книге.

```ts
type ChoiceNode = Readonly<{
  type: "choice";
  journal: StagePresentation;
  options: readonly { key: SemanticKey; when: ConditionExpr; next: NodeKey }[];
}>;

type GateNode = Readonly<{
  type: "gate";
  cases: readonly { when: ConditionExpr; next: NodeKey }[];
  otherwise?: NodeKey;
}>;

type SequenceNode = Readonly<{
  type: "sequence";
  nodes: readonly NodeKey[];
  next: NodeKey;
}>;

type BoundedRepeatNode = Readonly<{
  type: "bounded_repeat";
  body: NodeKey;
  maxIterations: number;
  continueWhen?: ConditionExpr;
  next: NodeKey;
}>;

type RewardNode = Readonly<{
  type: "reward";
  journal: StagePresentation;
  turnIn: { host: HostRef; scene: SceneKey };
  packages: readonly SemanticKey[];
  selection: "all" | "choose_one";
  next: NodeKey;
}>;

type EndNode = Readonly<{
  type: "end";
  outcome: SemanticKey;
  effects?: readonly EffectRef[];
}>;
```

Произвольные graph cycles запрещены. Повтор возможен только через
`bounded_repeat`; compiler разворачивает control state с iteration generation.

## Dialog schema

```ts
type DialogScene = Readonly<{
  resume: "stateless" | "resume_checkpoint" | "restart_on_open";
  entry: SemanticKey;
  nodes: Readonly<Record<SemanticKey, DialogNode>>;
}>;

type DialogNode =
  | {
      type: "screen";
      presenter?: PresenterRef;
      body: RichContent;
      answers: readonly DialogAnswer[];
    }
  | { type: "accept"; quest: "self"; effects?: readonly EffectRef[]; next: SemanticKey }
  | { type: "select_choice"; node: NodeKey; option: SemanticKey; next: SemanticKey }
  | { type: "claim_reward"; node: NodeKey; package?: SemanticKey; next: SemanticKey }
  | {
      type: "check";
      check: CheckSpec;
      success: SemanticKey;
      failure: SemanticKey;
      attempt: AttemptPolicy;
    }
  | { type: "effects"; effects: readonly EffectRef[]; next: SemanticKey }
  | { type: "end"; action: "close" | "return_board" | "return_map" };

type DialogAnswer = Readonly<{
  key: SemanticKey;
  kind: "normal" | "accept" | "decline" | "complete" | "fight" | "travel" | "close";
  label: RichContent;
  when: ConditionExpr;
  next: SemanticKey;
}>;
```

Screen и answers всегда образуют один клиентский экран. `presenter` меняет
имя/portrait говорящего только для этого screen. Закрытие окна не считается
ответом и не выполняет effects.

Check decision и выбранная answer сохраняются до effects. `attempt` определяет
`once_per_session | once_per_stage_activation | repeatable`; повторное открытие
никогда не перебрасывает уже committed attempt.

## Effects, rewards, encounters и interactions

```ts
type EffectRef = Readonly<{
  key: EffectKey;
  effect: EffectSpec;
}>;

type RewardPackage = Readonly<{
  presentation: RichContent;
  effects: readonly EffectRef[];
}>;

type EncounterDefinition = Readonly<{
  enemies: readonly RosterMember[];
  allies: readonly RosterMember[];
  loss: "retry" | "return_to_stage" | "branch";
  lossNext?: NodeKey;
  recovery: "recreate" | "return_to_ready";
  presentation: EncounterPresentation;
}>;

type InteractionDefinition = Readonly<{
  trigger: InteractionTrigger;
  cases: readonly InteractionCase[];
}>;
```

Точные `ConditionSpec`, `RequirementSpec`, `EffectSpec` и interaction payload
зафиксированы в [CAPABILITY_PAYLOADS_V1.md](CAPABILITY_PAYLOADS_V1.md), а их
handler boundaries — в [REGISTRY_CONTRACTS_V1.md](REGISTRY_CONTRACTS_V1.md).
Inline effect всегда имеет уникальный в пределах owner `key`, из которого
compiler создаёт устойчивый `operationKey`.

## Publication invariants

Candidate не публикуется, если:

- key/reference не существует или имеет неверный catalog kind;
- есть недостижимый node, отсутствующий terminal path или запрещённый cycle;
- stage может активировать второй stable stage, не закрыв первый;
- completion ссылается не на requirements этого objective;
- dialog/effect может выбрать option неактивного choice;
- reward package достижим повторно с тем же operation namespace;
- condition branches одинакового priority могут дать неоднозначную entry;
- `choose_one` не имеет selectable package либо UI presentation;
- macro/surface не поддерживается клиентом;
- handler registry не знает discriminator или его schema version.

Compiler создаёт immutable executable snapshot, dependency/event-interest
indexes и stable wire identities. Runtime исполняет snapshot, а не исходный
authoring JSON.
