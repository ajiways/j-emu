# Quest engine: registry contracts v1

> **Статус:** нормативный planning contract для расширяемости без per-quest
> production code. Реальные TypeScript signatures могут отличаться формой, но
> обязаны сохранить перечисленные гарантии.

Точные built-in authoring payload находятся в
[CAPABILITY_PAYLOADS_V1.md](CAPABILITY_PAYLOADS_V1.md).

## Один discriminator — один полный handler

Каждый registry member содержит:

- строгую versioned schema authoring payload;
- cross-content validator и dependency extractor;
- compiler в immutable runtime payload;
- evaluator/planner без I/O;
- event-interest или projection-dependency metadata;
- диагностический formatter для editor/API;
- unit, property и negative tests.

Наличие schema без runtime handler или handler без validator запрещает
publication. Unknown discriminator fail-fast на materialization и runtime load.

## Condition registry

```ts
interface ConditionHandler<A, C> {
  readonly type: string;
  parse(input: unknown): A;
  validate(authoring: A, catalogs: CatalogSnapshot): Issue[];
  compile(authoring: A, catalogs: CatalogSnapshot): C;
  dependencies(compiled: C): readonly ProjectionDependency[];
  evaluate(compiled: C, snapshot: QuestEvaluationSnapshot): boolean;
}
```

Condition evaluator не читает repositories и clock. Snapshot формирует facade
один раз под lock; `now` входит в него явно.

Initial condition catalog:

| Discriminator    | Authoritative source                          |
| ---------------- | --------------------------------------------- |
| `level`          | character snapshot                            |
| `quest_history`  | immutable run history/outcome                 |
| `quest_active`   | active run/stage                              |
| `run_fact`       | текущий run                                   |
| `world_fact`     | personal permanent fact                       |
| `artifact_count` | inventory lots с optional provenance selector |
| `money`          | character wallet                              |
| `reputation`     | reputation snapshot                           |
| `profession`     | profession/category snapshot                  |
| `area`           | current area/instance                         |
| `time_window`    | injected clock + authored zone/calendar       |
| `party`          | locked party snapshot                         |
| `entitlement`    | location/service capability snapshot          |
| `stage_active`   | current stable stage                          |

Boolean composition `all/any/not` принадлежит engine и не регистрируется как
domain condition.

## Requirement registry

```ts
interface RequirementHandler<A, C, P> {
  readonly type: string;
  parse(input: unknown): A;
  validate(authoring: A, catalogs: CatalogSnapshot): Issue[];
  compile(authoring: A, catalogs: CatalogSnapshot): C;
  interests(compiled: C): readonly EventInterest[];
  initial(compiled: C, snapshot: QuestEvaluationSnapshot): P;
  apply(compiled: C, progress: P, event: QuestEvent, context: ApplyContext): RequirementResult<P>;
  project(compiled: C, progress: P): RequirementProjection;
}
```

`apply` — pure и детерминированный. Result содержит changed/satisfied/new
progress и typed audit reason. Handler не закрывает stage и не выполняет effect.

Initial requirement catalog:

| Discriminator     | Matching facts                       | Назначение                              |
| ----------------- | ------------------------------------ | --------------------------------------- |
| `talk`            | `npc.interaction_completed`          | конкретный NPC/answer/interaction       |
| `talk_set`        | то же                                | A/B/C в любом порядке с member progress |
| `kill`            | `combat.defeat_credited`             | bot set/count и credit policy           |
| `win_encounter`   | `combat.fight_finished`              | конкретный quest encounter/generation   |
| `acquire_items`   | `inventory.items_added/removed`      | текущее или accumulated количество      |
| `possess_items`   | inventory snapshot + item changes    | authoritative owned count               |
| `deliver_items`   | dialog/interaction command           | atomic consume у host                   |
| `buy`             | `commerce.purchase_completed`        | store/item/quantity                     |
| `equip`           | `inventory.item_equipped`            | item/slot/instance                      |
| `use_item`        | `inventory.item_used`                | target/outcome/provenance               |
| `enter_area`      | `world.area_entered`                 | area/instance                           |
| `interact_object` | `world.object_interaction_completed` | point/action/outcome                    |
| `craft`           | `craft.completed`                    | recipe/input/output provenance          |
| `wait`            | `quest.wait_elapsed`                 | wait key/generation                     |
| `counter`         | explicit registered fact only        | bounded generic activity counter        |

`possess_items` является единственным snapshot-derived requirement. Он
пересчитывает readiness после relevant inventory event и не утверждает, каким
действием предмет получен. `acquire_items` хранит event accumulation и не
уменьшается от последующего drop, если policy явно не `current_owned`.

## Effect registry

```ts
interface EffectHandler<A, C> {
  readonly type: string;
  readonly phase: "transactional" | "operation";
  parse(input: unknown): A;
  validate(authoring: A, catalogs: CatalogSnapshot): Issue[];
  compile(authoring: A, catalogs: CatalogSnapshot): C;
  plan(compiled: C, snapshot: TransitionSnapshot, key: OperationKey): EffectPlan;
}
```

Handler только планирует. Transactional executor вызывает узкий owning port;
operation effect создаёт durable intent. Произвольного `SCRIPT`, reflection или
service lookup по строке нет.

Transactional catalog:

- `grant_item`, `consume_item`, `transform_items`, `reserve_item`;
- `change_money`, `grant_experience`, `change_reputation`;
- `grant_profession`, `remove_profession`, `grant_recipe`;
- `set_run_fact`, `set_world_fact`, `clear_world_fact`;
- `grant_location_entitlement`;
- `create_wait`, `cancel_wait`;

Choice selection, outcome commit и reward package expansion являются
interpreter primitives, а не произвольными authored effects. Они создают
обычные typed effect plans из package/outcome definition.

Operation catalog:

- `start_encounter`;
- `show_chat_message`, `show_popup`;
- `return_to_map`, `refresh_projection`;
- `invoke_service` только для зарегистрированного standalone service;
- будущая внешняя интеграция после отдельного security review.

Переход в другую локацию с оплатой не является простым quest effect: это
`ServiceInvocation` с quote/wait/commit. Effect может только начать такую
зарегистрированную операцию.

## Interaction outcome registry

Interaction pipeline выбирает ровно один case по priority:

```ts
type InteractionCase = Readonly<{
  key: string;
  when: ConditionExpr;
  consume: "never" | "on_start" | "on_success";
  response: readonly PresentationEffect[];
  wait?: WaitSpec;
  effects: readonly EffectRef[];
  next?: NodeKey;
}>;
```

Cases покрывают valid target, wrong area, wrong order, expired/missing asset,
cooldown и fallback. Validator требует unconditional fallback и запрещает две
доказуемо пересекающиеся cases одного priority.

## Check registry

Checks возвращают persisted decision, а не boolean на каждом view:

- `skill_threshold` — stat + threshold;
- `probability` — injected RNG draw;
- `inventory_choice` — выбор/наличие typed asset;
- `payment` — atomic affordability + debit только при commit;
- `condition` — deterministic ConditionExpr без RNG.

Compiled check задаёт attempt scope. RNG seed/draw, входной snapshot и result
сохраняются до перехода/эффектов в той же UoW.

## Operation executor contract

Executor получает persisted intent и обязан поддерживать:

```ts
execute(intent, idempotencyKey) ->
  | { status: "succeeded"; result: JsonValue; facts: QuestEvent[] }
  | { status: "retryable"; errorCode: string; retryAt: Date }
  | { status: "failed"; errorCode: string };
```

Он не помечает unknown payload успешным. Lease expiry позволяет повторный
claim; owning subsystem должен распознавать тот же idempotency key. Result и
facts сохраняются до подтверждения `succeeded`.

## Registration и composition root

Registry создаётся explicit factory списком built-in handlers. Feature module
может добавить handler только через public registration package; quest content
не выбирает class/module name. Startup проверяет уникальность discriminator и
поддерживаемую schema version.

Compiled snapshot сохраняет `{type, handlerVersion, payload}`. Runtime catalog
отказывается загрузить release, если binary не содержит точную совместимую
handler version. Rolling downgrade пока не поддерживается.

## Checklist нового capability

Перед добавлением discriminator должны существовать:

1. product semantics и владелец authoritative state;
2. strict authoring schema и catalog references;
3. pure compiler/runtime handler;
4. transaction/idempotency contract;
5. projection и editor diagnostics;
6. negative validation cases;
7. retry/reorder/concurrency/restart tests;
8. хотя бы один tracer без `questKey` branch в production code.
