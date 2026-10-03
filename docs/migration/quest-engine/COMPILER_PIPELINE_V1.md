# Quest engine: definition compiler pipeline v1

> **Статус:** нормативный planning contract. Compiler вызывается при candidate
> validation/materialization и является единственным путём authoring JSON в
> runtime snapshot.

## Inputs и artifacts

```ts
type CompileQuestInput = Readonly<{
  source: unknown;
  releaseId: string;
  catalogs: CatalogSnapshot;
  registries: QuestRegistrySet;
  wireIdentities: WireIdentityAllocator;
  limits: CompilerLimits;
}>;

type CompiledQuestArtifact = Readonly<{
  definition: CompiledQuestDefinitionV1;
  hostEntries: readonly CompiledHostEntry[];
  eventInterests: readonly CompiledEventInterest[];
  availability: readonly CompiledAvailabilityEntry[];
  wireIdentities: readonly ReservedWireIdentity[];
  dependencies: readonly QuestDependency[];
  sourceDigest: string;
  compatibilityDigest: string;
}>;
```

Compiler не пишет БД. Materializer сохраняет все artifacts одной UoW. Identity
allocator работает через reservation plan: ids не считаются выданными до
успешного commit.

## Issue model

```ts
type QuestCompileIssue = Readonly<{
  code: string;
  severity: "error" | "warning";
  path: readonly (string | number)[];
  questKey?: string;
  capability?: string;
  message: string;
  relatedPaths?: readonly (readonly (string | number)[])[];
  metadata?: Readonly<Record<string, string | number | boolean>>;
}>;
```

`code` стабилен для editor/tests, `message` — человекочитаемый и может меняться.
Path указывает source JSON, а не compiled row. Candidate с error не
materialize-ится; warning сохраняется в validation report.

Минимальные families codes:

- `quest.schema.*`;
- `quest.reference.*`;
- `quest.graph.*`;
- `quest.dialog.*`;
- `quest.capability.*`;
- `quest.presentation.*`;
- `quest.wire_identity.*`;
- `quest.compatibility.*`;
- `quest.limit.*`.

## Pipeline

### 1. Structural parse

- strict `quest.v1` discriminated schema;
- никаких coercion string→number, implicit ids или unknown field stripping;
- collect issues с полными paths, а не fail на первой ошибке;
- размер/depth limits проверяются до дорогой graph analysis.

Parse result либо typed document, либо только issues. Частично typed document
не попадает в следующие фазы, если structural shape небезопасна.

### 2. Local identity inventory

Compiler строит namespaces:

- graph node keys;
- entry/slot keys;
- scene/node/answer keys;
- reward, encounter, interaction keys;
- requirement/effect keys в owner scope;
- asset/fact keys.

Проверяются grammar, uniqueness, reserved prefixes и canonical case. Keys не
нормализуются молча: `Road_Watch` является ошибкой, а не `road_watch`.

### 3. Registry compilation

Для каждого condition/requirement/effect/check:

1. найти exact discriminator и handler version;
2. strict parse payload;
3. проверить local invariants;
4. разрешить catalog references;
5. скомпилировать canonical runtime payload;
6. собрать dependencies, event interests и overlay requirements.

Handler exception превращается в internal compiler failure и блокирует весь
candidate; он не становится обычным content issue.

### 4. Reference resolution

Разрешаются:

- graph edges и choice options;
- scene/dialog transitions;
- quest/reward/encounter/interaction refs;
- NPC/item/bot/area/store/recipe/profession/reputation ids;
- macro targets и supported surface capabilities;
- cross-quest prerequisites/history outcomes;
- fact definitions и value types.

Reference хранит semantic identity и нужный immutable catalog revision/digest.
Runtime не делает «best effort» lookup исчезнувшего объекта.

### 5. Graph validation

Проверки:

- entry существует;
- каждый node достижим;
- каждый reachable path может прийти к `end`;
- произвольных cycles нет;
- `bounded_repeat.maxIterations` конечен и body возвращается только через frame;
- control closure имеет вычислимый upper hop bound;
- один path не активирует два stable stages;
- completion ссылается только на requirements owner objective;
- sequence/repeat frames правильно вложены;
- `choice` имеет хотя бы одну потенциально достижимую option;
- reward packages/selection согласованы.

Condition satisfiability в общем случае неразрешима, поэтому compiler различает:

- доказанную ошибку — error;
- потенциальное перекрытие/недостижимость — warning с paths;
- явный author override warning только через typed suppression metadata будущей
  editor API, не через свободный комментарий.

### 6. Dialog validation

- scene entry и все next существуют;
- cycle допустим только если содержит screen с user choice; бесконечный
  instantaneous dialog cycle запрещён;
- committed nodes (`accept/check/select/claim/effects`) имеют persisted boundary;
- answer conditions и priority не создают duplicate semantic action;
- quest/stage-bound scene не может выбрать чужой/inactive choice;
- `restart_on_open` запрещён, если путь до checkpoint содержит non-repeatable
  effect/check;
- presenter/macros/styles поддерживаются target surface.

### 7. Cross-quest dependency graph

Edges строятся из `quest_history`, `quest_active` и named world outcomes.
Compiler проверяет:

- prerequisite cycles;
- ссылку на существующий terminal outcome/ending;
- archived dependency policy;
- невозможную комбинацию mutually exclusive permanent outcomes;
- impact changed quest на downstream availability.

### 8. Wire identity planning

Stable ids выделяются для book/point/answer/target/counter identities. Mapping
key состоит из identity kind, quest/scene owner и semantic key.

- подтверждённый imported id резервируется явно;
- collision — error;
- удалённый identity не переиспользуется;
- новый id берётся из PostgreSQL sequence reservation;
- numeric limits клиента проверяются до materialization.

### 9. Canonicalization и digests

Source digest вычисляется по canonical authoring semantics:

- object keys sorted;
- authored semantic arrays сохраняют порядок;
- editor metadata отсутствует;
- числа/строки имеют единственное JSON representation;
- wire ids не входят в source digest.

Compatibility digest исключает presentation-only fields, но включает graph,
conditions, capability payloads, effects, assets и identity-affecting changes.
Классификацию presentation-only выполняет typed field policy, не JSON diff по
allowlist paths в runtime.

### 10. Artifact emission

Compiled snapshot содержит только:

- exact schema/handler versions;
- resolved immutable references;
- dense graph/dialog lookup maps;
- precomputed closure metadata;
- condition dependencies и event interests;
- semantic presentation content;
- stable wire identity references.

Source notes/layout и validation warnings туда не входят. Snapshot имеет size
limit и проверяется round-trip decoder-ом до выдачи materializer.

## Determinism

Одинаковые source/catalog/registry versions дают byte-identical artifact и
digests независимо от process, map insertion order и database row order.

Обязательный test запускает compiler с permuted input maps/catalog ordering и
сравнивает canonical bytes. Clock/RNG/network/compiler-global counters
запрещены.

## Candidate transaction

Publication service:

1. блокирует candidate/active release;
2. загружает immutable catalog snapshot;
3. компилирует все quest definitions;
4. строит cross-quest graph и общий wire reservation plan;
5. проверяет active-run impact policy;
6. сохраняет artifacts/ids/materialized content;
7. активирует release;
8. commit;
9. только после commit инвалидирует runtime catalog cache.

Любая ошибка оставляет active release и identity registry неизменными.

## Compiler test matrix

- golden artifact для TQ-0/TQ-2;
- strict unknown fields/discriminators;
- every broken reference kind;
- unreachable/dead-end/cycle/repeat-bound cases;
- dialog checkpoint/cycle violations;
- wire collision/exhaustion;
- deterministic canonical bytes;
- handler version missing/downgrade;
- candidate rollback после identity reservation;
- cross-quest cycle и removed outcome impact;
- limits на размер/depth/count.
