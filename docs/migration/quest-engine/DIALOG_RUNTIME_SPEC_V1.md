# Quest engine: dialog runtime specification v1

> **Статус:** нормативный runtime contract для board/dialog части QE-04. Он
> дополняет продуктовую семантику `DIALOG_SEMANTICS.md` конкретным lifecycle,
> командами и transaction order.

## Три разных объекта

1. `InteractionBoardProjection` — условный welcome/intro и список доступных
   entries конкретного host.
2. `DialogScene` — immutable authored graph экранов и semantic actions.
3. `DialogSession` — persisted прохождение scene конкретным героем.

Открытие NPC сначала возвращает board. Выбор board entry открывает scene. Board
entry label не является NPC reply, screen body или quest target text.

## Board resolution

```ts
type ResolveBoardInput = Readonly<{
  heroId: number;
  host: HostRef;
  areaId?: number;
  instanceId?: string;
}>;
```

Resolver получает один evaluation snapshot и:

1. выбирает highest-priority matching `boardIntro` variant;
2. загружает compiled host entries active release;
3. проверяет owner lifecycle и entry condition;
4. разрешает slot variants;
5. сортирует по `order`, затем stable wire identity;
6. возвращает только доступные entries.

Несколько квестов/диалогов/магазин/склад/service могут находиться на одной
board. Quest runtime не хранит lifecycle магазина или travel service; entry
вызывает public owner command.

## Session identity

```ts
type DialogSessionSnapshot = Readonly<{
  sessionId: string;
  heroId: number;
  host: HostRef;
  owner: { type: "quest"; questKey: QuestKey; runId?: string } | StandaloneOwnerRef;
  releaseId: string;
  sceneKey: SceneKey;
  activationKey: string;
  currentNode: SemanticKey;
  status: "open" | "completed" | "closed" | "invalidated";
  revision: number;
  resume: "stateless" | "resume_checkpoint" | "restart_on_open";
}>;
```

`activationKey` связывает session с offer/stage/item episode/service activation.
Одна open session на `(hero, scene, activationKey)`. Новая scene другого NPC не
перезаписывает её.

## Открытие entry

`OpenDialogEntry` является command, а не query:

1. lock hero;
2. повторно resolve entry/host/context;
3. определить owner release/run/stage activation;
4. найти существующую session;
5. применить resume policy;
6. выполнить instantaneous dialog nodes до первого screen/end;
7. сохранить session/checkpoints;
8. commit;
9. построить screen projection.

Policies:

- `stateless`: persisted session не нужна, только если graph не содержит
  effects/checks/accept/select/claim и каждый open начинает с entry;
- `resume_checkpoint`: reopen показывает committed current screen;
- `restart_on_open`: новая activation разрешена только если validator доказал
  отсутствие повторяемых side effects/RNG до checkpoint.

## Screen projection

```ts
type DialogProjection = Readonly<{
  sessionId?: string;
  revision?: number;
  presenter: PresenterProjection;
  body: RichContentProjection;
  answers: readonly DialogAnswerProjection[];
  rewards?: readonly RewardChoiceProjection[];
  wait?: WaitProjection; // persisted server wait, не answer waiting_time
  action: "show" | "close" | "return_board" | "return_map";
}>;
```

Optional pre-submit delay принадлежит конкретному `DialogAnswerProjection` и
содержит только duration/title/picture/video presentation. Клиент показывает
его до отправки `ChooseDialogAnswer`; server session поэтому не меняется при
cancel. Это не `WaitProjection` и не строка `quests.waits`.

NPC response/body и answer list находятся на одном экране. Недоступные answers
не передаются. Presenter берётся из screen override, иначе scene/host default;
его смена не создаёт новый NPC или session.

Projection не выполняет graph transition и не делает RNG roll. Rich macros
компилируются для конкретной surface после semantic projection.

## Выбор answer

`ChooseDialogAnswer` под hero/session lock:

1. проверить ownership/status/revision/current node;
2. найти answer и повторно проверить condition/context;
3. вставить command receipt;
4. сохранить answer decision;
5. перейти в next node;
6. выполнить instantaneous nodes по одному;
7. для quest action вызвать transition engine в той же UoW;
8. выполнить transactional effects/записать operations;
9. остановиться на screen/end;
10. увеличить session/run/projection revisions и commit.

Повтор operation id возвращает сохранённый projection/result. Повтор с новой
operation id и stale revision отклоняется. Answer после закрытия session не
выполняется.

## Instantaneous dialog nodes

- `accept`: вызывает quest accept, затем идёт в `next`;
- `select_choice`: вызывает choice transition активного run;
- `claim_reward`: выполняет reward claim/selection;
- `check`: получает/создаёт persisted check decision и выбирает edge;
- `effects`: планирует typed effects;
- `end`: задаёт UI action и terminal session status.

На одной answer transition действует hard node/effect limit. Instantaneous
cycle является compiler error и runtime invariant rollback.

## Checks и выход из окна

Check attempt identity:

```text
sessionId / nodeKey / attemptScopeKey / attemptNo
```

Input stats, modifiers, RNG draw и result записываются до effects/edge в той же
UoW. Закрытие UI:

- до выбора answer/check node ничего не commit-ит;
- после committed answer не отменяет decision;
- reopen возвращает checkpoint после decision;
- сетевой retry не создаёт новый roll;
- `repeatable` создаёт новый attempt только после authored возврата в check node,
  а не от простого reopen.

## Close semantics

`CloseDialog` — отдельный command только если клиент действительно сообщает
закрытие. Он может изменить `open → closed`, но:

- не откатывает answers/effects;
- не считается decline;
- не отменяет quest;
- не выбирает branch;
- не перезапускает check;
- не закрывает wait/encounter автоматически.

Если клиент не сообщает close надёжно, session остаётся open до reopen,
invalidation или retention cleanup. Correctness от close event не зависит.

## Invalidation

Session становится invalidated, если:

- run/stage activation завершилась другим command/event;
- definition rollout отменил run;
- permanent outcome заменил/скрыл host;
- item-host instance исчез/сменил generation;
- service/activity activation завершена;
- security-relevant context больше не существует.

Invalidation сохраняет decisions для audit. Последующий answer получает typed
stale/closed error, reopen заново resolve-ит board/entry.

## Item-hosted episodes

Предмет может открыть standalone/quest scene. Session owner содержит exact item
instance/provenance generation. Rotating dialog selector:

1. создаёт episode activation;
2. выбирает variant через persisted decision/RNG;
3. pin-ит scene/variant до завершения/expiry;
4. reopen показывает тот же variant;
5. новый dialog возможен только новой episode activation согласно policy.

Удаление/expiry item инвалидирует session либо следует authored recovery; нельзя
перейти к scene, ссылаясь только на catalog item id другого экземпляра.

## Dialog ↔ quest boundaries

Dialog runtime может вызвать только публичные semantic actions:

- accept owning quest;
- commit active choice;
- claim active reward;
- выполнить зарегистрированный interaction/effect;
- завершить подтверждённый talk interaction.

Он не меняет requirement progress напрямую (`BUMP_GOAL` запрещён). Talk fact
создаётся после committed semantic milestone и проходит event router/receipt.

## Error mapping

Ожидаемые denials:

- entry/answer больше недоступны;
- stale session revision/node;
- session invalidated/closed;
- owning run/stage сменился;
- check attempt уже committed;
- effect/payment/resource denied.

Wire adapter по code решает: обновить текущий screen, вернуть board, закрыть окно
или показать сообщение. Runtime не возвращает произвольный HTML error.

## Persistence/indexes

Нужны:

- `dialog_sessions` с partial unique open activation;
- `dialog_decisions` с command id и semantic answer;
- `dialog_check_attempts` либо typed extension decision row;
- index hero/status, owner activation, item instance generation;
- retention только после terminal audit/history requirements.

## Test matrix

- много pre-accept screens → accept;
- close до answer и после answer;
- reconnect на каждом checkpoint;
- duplicate/stale answer;
- skill/probability success/failure без reroll;
- cycle/back navigation без side-effect duplication;
- смена presenter;
- active/ready/completed NPC responses;
- два NPC sessions не перезаписывают друг друга;
- item-hosted rotating scene pin/reopen/expiry;
- hidden answer direct request;
- concurrent event invalidates open session;
- reward icon selection exactly once;
- end actions close/board/map соответствуют projection.
