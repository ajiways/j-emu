# Quest engine: capability payloads v1

> **Статус:** точный authoring catalog для `quest.v1`. Все объекты strict:
> дополнительные поля запрещены, числовые ids — положительные integers,
> quantities/durations — safe integers в указанных единицах.

## Общие selectors

```ts
type ItemSelector = Readonly<{
  itemIds: readonly number[]; // non-empty, unique
  provenance?:
    | { type: "any" }
    | { type: "quest_asset"; assetKey: SemanticKey; generation: "current" }
    | { type: "operation"; effectKey: EffectKey };
}>;

type InstancePolicy = "any" | "same_instance";
type NumericComparison =
  | { operator: "eq" | "gte" | "lte"; value: number }
  | { operator: "between"; min: number; max: number };

type AssetSelector = ItemSelector;

type PresenterRef =
  | { type: "npc"; npcId: number }
  | { type: "item"; itemId: number }
  | { type: "custom"; title: RichContent; portraitKey: SemanticKey };

type CounterPresentation = Readonly<{
  requirement: RequirementKey;
  member?: SemanticKey;
  label: RichContent;
  format: "value_limit" | "check" | "text";
}>;

type WorldAffordance =
  | { type: "related_monster"; botIds: readonly number[] }
  | { type: "area_object"; areaId: number; objectKey: SemanticKey; requirement?: RequirementKey }
  | { type: "npc_marker"; npcId: number; intent: "active" | "ready" };

type WaitPresentation = Readonly<{
  title: RichContent;
  body?: RichContent;
  presenter?: PresenterRef;
  completionMessage?: RichContent;
}>;

type RosterMember = Readonly<{ botId: number; count: number }>;

type EncounterPresentation = Readonly<{
  title?: RichContent;
  startMessage?: RichContent;
  winMessage?: RichContent;
  lossMessage?: RichContent;
}>;

type AttemptPolicy = "once_per_session" | "once_per_stage_activation" | "repeatable";

type CheckSpec =
  | { type: "skill_threshold"; skill: SemanticKey; threshold: number }
  | { type: "probability"; chancePermille: number }
  | { type: "inventory_choice"; selector: ItemSelector; quantity: number }
  | { type: "payment"; amountMinor: number }
  | { type: "condition"; condition: ConditionExpr };
```

`itemIds` означает OR по catalog id. Несколько разных обязательных предметов
задаются несколькими requirements/effect inputs. Quest-owned item без
`quest_asset` selector не может очищаться отменой.

## Condition payloads

```ts
type ConditionSpec =
  | { type: "level"; min?: number; max?: number }
  | {
      type: "quest_history";
      quest: QuestKey;
      outcomes: readonly SemanticKey[];
      ending?: SemanticKey;
    }
  | { type: "quest_active"; quest: QuestKey; stage?: NodeKey }
  | { type: "run_fact"; key: SemanticKey; comparison: ValueComparison }
  | { type: "world_fact"; key: SemanticKey; comparison: ValueComparison }
  | { type: "artifact_count"; selector: ItemSelector; quantity: NumericComparison }
  | { type: "money"; amountMinor: NumericComparison }
  | { type: "reputation"; reputationId: number; value: NumericComparison }
  | { type: "profession"; professionId: number; state: "present" | "absent" }
  | { type: "area"; areaIds: readonly number[]; instance: "any" | "none" | "present" }
  | { type: "time_window"; schedule: TimeWindow }
  | { type: "party"; size: NumericComparison }
  | { type: "entitlement"; key: SemanticKey; state: "present" | "absent" }
  | { type: "stage_active"; node: NodeKey };

type ValueComparison =
  | { operator: "exists" | "missing" }
  | { operator: "eq" | "neq"; value: string | number | boolean }
  | { operator: "in"; values: readonly (string | number | boolean)[] };

type TimeWindow = Readonly<{
  timeZone: string; // IANA zone from server allowlist
  weekdays?: readonly (1 | 2 | 3 | 4 | 5 | 6 | 7)[];
  startLocal: string; // HH:mm:ss
  endLocal: string; // HH:mm:ss, earlier means crosses midnight
}>;
```

Validation rules:

- `level` has at least one bound and `min <= max`;
- quest references cannot create availability dependency cycle;
- fact value type must match its registered fact definition;
- time zone must be allowlisted and DST behavior is evaluated by a shared
  schedule service, never by manually adding seconds;
- `artifact_count` reads inventory snapshot and does not prove acquisition;
- `stage_active` is allowed only inside the owning quest definition.

## Requirement payloads

Каждый requirement хранит progress своей activation generation. `required`
всегда больше нуля.

```ts
type RequirementSpec =
  | TalkRequirement
  | TalkSetRequirement
  | KillRequirement
  | WinEncounterRequirement
  | AcquireItemsRequirement
  | PossessItemsRequirement
  | DeliverItemsRequirement
  | BuyRequirement
  | EquipRequirement
  | UseItemRequirement
  | EnterAreaRequirement
  | InteractObjectRequirement
  | CraftRequirement
  | WaitRequirement;
```

### Talk

```ts
type TalkRequirement = Readonly<{
  type: "talk";
  npcId: number;
  interactionKey?: SemanticKey;
  answerKey?: SemanticKey;
}>;

type TalkSetRequirement = Readonly<{
  type: "talk_set";
  members: readonly Readonly<{
    key: SemanticKey;
    npcId: number;
    interactionKey?: SemanticKey;
    answerKey?: SemanticKey;
  }>[];
  required: "all" | { atLeast: number };
}>;
```

Открытие NPC не засчитывается. Fact появляется после завершённой interaction
или committed answer. Повтор одного member не увеличивает set progress.

### Combat

```ts
type KillRequirement = Readonly<{
  type: "kill";
  botIds: readonly number[];
  required: number;
  count: "combatants" | "fights";
  purpose?: readonly ("hunt" | "quest_encounter" | "dungeon" | "arena" | "other")[];
}>;

type WinEncounterRequirement = Readonly<{
  type: "win_encounter";
  encounter: SemanticKey;
  required: number;
}>;
```

`kill` не читает loot. `win_encounter` требует совпадающие encounter key,
generation и terminal outcome `won`.

### Inventory, delivery и commerce

```ts
type AcquireItemsRequirement = Readonly<{
  type: "acquire_items";
  selector: ItemSelector;
  required: number;
  mode: "accumulated" | "current_owned";
  reasons?: readonly ("loot" | "reward" | "purchase" | "craft")[];
}>;

type PossessItemsRequirement = Readonly<{
  type: "possess_items";
  selector: ItemSelector;
  required: number;
}>;

type DeliverItemsRequirement = Readonly<{
  type: "deliver_items";
  selector: ItemSelector;
  required: number;
  host: HostRef;
  consume: true;
}>;

type BuyRequirement = Readonly<{
  type: "buy";
  storeIds?: readonly string[];
  selector: ItemSelector;
  required: number;
}>;

type EquipRequirement = Readonly<{
  type: "equip";
  selector: ItemSelector;
  slots?: readonly string[];
  required: number;
  distinctInstances: boolean;
}>;
```

`deliver_items` завершается только командой у указанного host. Проверка,
consume, progress и stage closure выполняются одной UoW. Простое исчезновение
предмета из bag не считается delivery.

### Use, area, craft и wait

```ts
type UseItemRequirement = Readonly<{
  type: "use_item";
  selector: ItemSelector;
  required: number;
  targets?: readonly InteractionTarget[];
  outcomes: readonly SemanticKey[];
  distinctInstances: boolean;
}>;

type EnterAreaRequirement = Readonly<{
  type: "enter_area";
  areaIds: readonly number[];
  required: number;
  distinctAreas: boolean;
}>;

type InteractObjectRequirement = Readonly<{
  type: "interact_object";
  targets: readonly { areaId: number; objectKey: SemanticKey }[];
  required: "all" | { atLeast: number };
  order: "any" | "listed";
  mismatch: "ignore" | "reset";
  outcomes: readonly SemanticKey[];
}>;

type CraftRequirement = Readonly<{
  type: "craft";
  recipeIds: readonly number[];
  required: number;
  output?: ItemSelector;
}>;

type WaitRequirement = Readonly<{
  type: "wait";
  waitKey: SemanticKey;
}>;

type InteractionTarget =
  | { type: "self" }
  | { type: "npc"; npcId: number }
  | { type: "area"; areaId: number }
  | { type: "area_object"; areaId: number; objectKey: SemanticKey }
  | { type: "combat_target"; botIds: readonly number[] };
```

Ordered object interactions используют progress самого requirement. Для более
сложной последовательности с разными текстами используются несколько graph
stages, а не скрытая state machine внутри payload.

## Party credit override

```ts
type PartyCreditOverride = Readonly<{
  scope: "personal" | "same_area" | "same_instance" | "participants";
  filters?: readonly ("online" | "alive" | "participated")[];
}>;
```

Override может только сузить/явно заменить default policy definition. Reward и
quest loot остаются персональными независимо от progress scope.

## Effect payloads

```ts
type EffectSpec =
  | {
      type: "grant_item";
      assetKey?: SemanticKey;
      itemId: number;
      quantity: number;
      ownership: "temporary" | "permanent";
      expiresAfterSec?: number;
      recovery?: RecoveryPolicy;
    }
  | { type: "consume_item"; selector: ItemSelector; quantity: number }
  | { type: "transform_items"; transformation: SemanticKey }
  | { type: "change_money"; amountMinor: number }
  | { type: "grant_experience"; amount: number }
  | { type: "change_reputation"; reputationId: number; amount: number; cap?: number }
  | { type: "grant_profession"; professionId: number; conflict: "deny" }
  | { type: "remove_profession"; professionId: number }
  | { type: "grant_recipe"; recipeId: number }
  | { type: "set_run_fact"; key: SemanticKey; value: FactValue }
  | { type: "set_world_fact"; key: SemanticKey; value: FactValue }
  | { type: "clear_world_fact"; key: SemanticKey }
  | { type: "grant_location_entitlement"; key: SemanticKey }
  | {
      type: "create_wait";
      waitKey: SemanticKey;
      durationSec: number;
      presentation: WaitPresentation;
    }
  | { type: "cancel_wait"; waitKey: SemanticKey }
  | { type: "start_encounter"; encounter: SemanticKey }
  | { type: "show_message"; channel: "chat" | "popup"; content: RichContent };

type FactValue = string | number | boolean;

type RecoveryPolicy =
  | { type: "deny"; message: RichContent }
  | { type: "reissue"; limit: number; scene?: SceneKey }
  | { type: "reset_stage" }
  | { type: "branch"; next: NodeKey }
  | { type: "cancel_run" };
```

`start_encounter` и `show_message` компилируются в operation intents, несмотря
на единый authoring union. Handler phase определяет исполнение. Отрицательная
money/reputation mutation проходит policy owning service; author не может
обойти его ограничения.

Profession replacement не входит в baseline: отдельный outcome сначала
удаляет конкретную старую профессию, затем выдаёт новую одной planned bundle;
validator проверяет category cardinality.

## Interaction cases

```ts
type InteractionTrigger =
  | { type: "item_use"; selector: ItemSelector }
  | { type: "area_object"; areaId: number; objectKey: SemanticKey };

type InteractionCase = Readonly<{
  key: SemanticKey;
  priority: number;
  when: ConditionExpr;
  consume: "never" | "on_start" | "on_success";
  response?: { channel: "chat" | "popup"; content: RichContent };
  wait?: Readonly<{
    key: SemanticKey;
    durationSec: number;
    presentation: WaitPresentation;
    onComplete: readonly EffectRef[];
  }>;
  effects: readonly EffectRef[];
  next?: NodeKey;
}>;
```

Case selection и consume decision фиксируются до запуска wait/effects. Последний
case обязан иметь unconditional true condition и обычно выражает wrong-context
поведение.

## Limits v1

Первый compiler использует конфигурируемые server limits со следующими
безопасными defaults:

- 256 graph nodes, 128 dialog nodes на scene, 64 scenes;
- 32 requirements на objective, 32 answers на screen;
- 128 effects на definition и 32 effects в одной transition;
- 64 condition leaves и depth 8;
- duration максимум 366 дней;
- RichContent и string limits определяет surface capability matrix.

Превышение — publication issue, не runtime truncation.
