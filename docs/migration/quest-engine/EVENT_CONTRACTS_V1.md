# Quest engine: event contracts v1

> **Статус:** нормативный planning contract. Определяет факты, которыми игровые
> модули двигают quest progress. Wire-запросы и callbacks не являются событиями.

## Envelope

```ts
type QuestEvent<K extends QuestEventKind = QuestEventKind> = Readonly<{
  schemaVersion: "quest-event.v1";
  eventId: string;
  kind: K;
  occurredAt: string; // UTC ISO-8601, назначает владелец факта
  actorHeroId: number;
  participantHeroIds: readonly number[];
  context: Readonly<{
    areaId?: number;
    instanceId?: string;
    partyId?: number;
  }>;
  origin: Readonly<{
    subsystem: QuestEventSubsystem;
    operationId: string;
    causationId?: string;
    correlationId?: string;
  }>;
  payload: QuestEventPayload<K>;
}>;
```

`participantHeroIds` sorted, unique и содержит actor, если actor является
участником. Router всё равно получает authoritative party/area/instance
snapshot: envelope не даёт право на shared credit сам по себе.

## Identity и retry

`eventId` обозначает один доменный факт, а не одну попытку доставки.

| Источник        | Формирование id                           |
| --------------- | ----------------------------------------- |
| OA/game command | server `operationId + fact ordinal`       |
| fight terminal  | `fightId + terminal revision + fact kind` |
| quest encounter | `encounterId + generation + outcome`      |
| craft/store     | persisted owning operation id + ordinal   |
| timer/expiry    | persisted wait/asset id + generation      |

Retry обязан повторить тот же id и byte-equivalent canonical payload. Тот же id
с другим digest — corruption error. Новый UUID внутри quest callback запрещён.

Если legacy wire-команда не несёт request id, сервер не может отличить сетевой
retry после reconnect от осознанного повторного действия. В этом случае
`operationId` устойчив только внутри принятого server execution; повтор снаружи
защищают authoritative preconditions, run/session revision и одноразовая
decision identity. Документация не заявляет недоказуемый exactly-once между
двумя неразличимыми wire requests.

## Command и event — разные входы

Commands выражают намерение и проходят authorization:

- `AcceptQuest`, `CancelQuest`, `ChooseDialogAnswer`, `SelectReward`;
- `BeginInteraction`, `FinishInteraction`, `CloseDialog`;
- `ClaimActivityReward`, `InvokeTravelService`.

Events утверждают уже совершившийся факт другого aggregate. Нельзя отправить
`item.used`, не выполнив authoritative inventory operation. Quest facade может
обработать command и возникший факт в одной UoW, но сохраняет разные receipts.

## Initial event catalog

### NPC и мир

```ts
type NpcInteractionCompleted = {
  npcId: number;
  interactionKey?: string;
  dialogDecisionId?: string;
};

type AreaEntered = { areaId: number; fromAreaId?: number; movementId: string };

type AreaObjectInteractionCompleted = {
  areaId: number;
  objectKey: string;
  interactionId: string;
  outcome: string;
};
```

Kinds: `npc.interaction_completed`, `world.area_entered`,
`world.object_interaction_completed`.

Открытие board или dialog не является progress. Talk засчитывается после
конкретного committed answer/node либо отдельной подтверждённой interaction.

### Inventory и equipment

```ts
type ItemLotRef = {
  itemId: number;
  instanceId: string;
  quantity: number;
  provenance?: { source: string; sourceId: string; generation?: number };
};

type ItemChanged = {
  lots: readonly ItemLotRef[];
  reason: "loot" | "reward" | "purchase" | "craft" | "drop" | "consume" | "expiry" | "admin";
};

type ItemUsed = {
  lot: ItemLotRef;
  useOperationId: string;
  consumedQuantity: number;
  target?: InteractionTarget;
  outcome: "applied" | "rejected" | "expired";
  outcomeKey?: string;
};

type ItemEquipped = { lot: ItemLotRef; slot: string; previousInstanceId?: string };
```

Kinds: `inventory.items_added`, `inventory.items_removed`,
`inventory.item_used`, `inventory.item_equipped`.

Quantity after mutation не заменяет событие. `item_used` возникает и для
authored rejected outcome, если сама попытка использования была committed;
requirement явно выбирает допустимые outcomes.

### Commerce и crafting

```ts
type PurchaseCompleted = {
  storeId: string;
  lines: readonly { itemId: number; quantity: number; unitPriceMinor: number }[];
  totalMinor: number;
};

type CraftCompleted = {
  recipeId: number;
  inputLots: readonly ItemLotRef[];
  outputLots: readonly ItemLotRef[];
  professionId?: number;
};
```

Kinds: `commerce.purchase_completed`, `craft.completed`. Соответствующие
inventory events могут иметь тот же `operationId`, но другой `eventId`.
Requirement выбирает semantic fact и не пытается угадать источник по bag delta.

### Combat

```ts
type DefeatCredit = {
  fightId: string;
  defeated: readonly { botId: number; combatantId: string; count: number }[];
  encounterId?: string;
  contribution: "participant" | "party_credit";
};

type FightFinished = {
  fightId: string;
  encounterId?: string;
  outcome: "won" | "lost" | "escaped" | "aborted";
  purpose: "hunt" | "quest_encounter" | "dungeon" | "arena" | "other";
};
```

Kinds: `combat.defeat_credited`, `combat.fight_finished`. Kill progress читает
первое событие; quest encounter outcome — второе с обязательным совпадающим
`encounterId`. Loot является отдельным inventory fact.

### Quest-owned time и assets

```ts
type WaitElapsed = { waitId: string; generation: number; dueAt: string };
type AssetExpired = { assetGrantId: string; generation: number; expiredAt: string };
```

Kinds: `quest.wait_elapsed`, `quest.asset_expired`. Их создаёт worker из
persisted rows. Request-time catch-up создаёт тот же deterministic id, поэтому
не конфликтует с параллельным worker.

### Capability и character facts

```ts
type CharacterValueChanged = {
  subject: "level" | "reputation" | "profession" | "location_entitlement";
  key: string;
  before: string | number | null;
  after: string | number | null;
};
```

Kind `character.value_changed` нужен для dirty projection/availability refresh.
Обычно он не двигает objective: conditions перечитываются из authoritative
snapshot. Это предотвращает хранение второй истины о level/reputation.

## Event application

В одной UoW router:

1. валидирует schema и canonical digest;
2. определяет candidate runs через compiled interest index;
3. блокирует eligible heroes в sorted order, затем их runs;
4. перечитывает authoritative context и party eligibility;
5. вставляет `(eventId, runId)` receipt;
6. применяет event ко всем matching requirements активного stage;
7. выполняет graph closure и transactional effects;
8. сохраняет progress/effects/operation intents/projection revision;
9. commit-ит всё либо ничего.

Один event может изменить несколько requirements одного stage и несколько
квестов героя. Порядок authored requirements не меняет результат, кроме
`ordered` completion, где interpreter использует persisted sequence position.

## Derived facts и loop protection

Transactional effect может вызвать owning service, который возвращает новые
domain facts, например item grant. Они добавляются в локальную deterministic
event queue с `causationId` исходной transition. Каждый получает устойчивый id
из effect `operationKey + ordinal`.

Queue имеет depth/count limit; повтор `(kind, canonical payload, causation
chain)` без изменения state считается cycle и откатывает command. Post-commit
operations доставляют свои факты новым facade call с тем же правилом receipts.

## Ordering

Глобального порядка между независимыми events нет. Correctness обеспечивают
hero lock, run revision и requirements, которые должны быть commutative там,
где порядок не заявлен. `occurredAt` не используется для last-write-wins.

Событие старой generation не изменяет новую stage/repeat/wait activation.
Reordered delivery либо применяется к совпадающей generation, либо сохраняется
как ignored receipt с причиной; оно не переносится на текущую цель.
