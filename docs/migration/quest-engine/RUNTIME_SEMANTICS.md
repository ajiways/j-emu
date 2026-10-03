# Quest engine: runtime semantics

> **Статус:** целевой план. Конкретные ports/tables фиксируются capability
> checkpoint перед production code.

Нормативные алгоритмы уточнены в `*_V1` документах из
[карты проекта](README.md#карта-документов); этот документ остаётся общим
обзором семантики.

## Командная модель

Quest engine получает только типизированные команды и domain events:

- `OpenInteractionBoard` / `OpenDialog` — read + projection;
- `UseInteractionItem` / `ChooseInteractionEpisode`;
- `AcceptQuest`;
- `ChooseAnswer`;
- `ApplyDomainEvent`;
- `BeginAreaInteraction` / `FinishAreaInteraction`;
- `TurnInQuest`;
- `CancelQuest`;
- `RunCooldownCatchUp`;
- `StartService` / `CompleteService`;
- `StartActivityChallenge` / `ClaimActivityReward`;
- `ApplyDefinitionRollout`.

HTTP/OA handlers не вызывают отдельные goal helpers и не собирают награды.
Они decode → command → response mapper.

## Обработка события

```text
domain module commits fact
        ↓
creates eventId + participant snapshot
        ↓
QuestEventRouter finds subscriptions in active revisions
        ↓
for each eligible hero/run under hero lock:
  reject duplicate eventId
  evaluate matcher against captured event
  update objective algebra
  close completed graph nodes
  activate reachable nodes
  execute IN_TRANSACTION effects
  persist outbox effects
        ↓ commit
execute AFTER_COMMIT outbox
build/push dirty projections
```

Event routing не делает запрос «ко всем квестам во всех героях». Active
revision при materialize строит subscription index по event kind и matcher
keys (NPC id, bot id, artifact id, area/action id). Конкретная storage strategy
определяется performance spike.

## Transaction boundary

Все persistent изменения одного героя от одного event выполняются в одной UoW:

- hero/run lock;
- event dedup marker;
- progress/graph transition;
- inventory/money/fact mutations через public ports;
- reward/asset ledger;
- history terminal record;
- after-commit outbox rows.

Ошибка любого обязательного in-transaction effect откатывает всё событие. Нет
частичного progress без consume или award без terminal state.

Multi-item delivery/craft/repair проходит через один atomic transformation
port. Quest engine не списывает ингредиенты циклом и не вызывает profession
craft как shortcut. Operation сначала разрешает конкретные attributed inputs,
проверяет все guards/capacity, затем единым commit создаёт outputs и immutable
result. Подробный контракт: [ASSET_TRANSFORMS.md](ASSET_TRANSFORMS.md).

RAM fight нельзя стартовать до commit. Start intent сохраняется, затем
исполняется after commit. Если after-commit effect не выполнился, он остаётся
диагностируемым и retryable; повтор не может создать второй fight благодаря
operation id.

## Идемпотентность

Уникальные ключи:

- event application: `(runId, eventId, objectiveNodeId)`;
- effect: `(runId, transitionId, effectId, activationNumber)`;
- reward: `(runId, rewardPackageId, endingId)`;
- repeat reward дополнительно защищён `cycleKey`;
- dialog choice использует request/answer transition id, а RNG result
  сохраняется до side effects.

Повторный OA после timeout возвращает состояние уже применённого перехода либо
явную несовместимость курсора, но не бросает RNG и не выдаёт награду заново.

## Dialog command и reopen

`OpenDialog` выбирает entry по одному snapshot и возвращает текущий checkpoint
подходящей `DialogSession`. Projection одного checkpoint одновременно содержит
реплику/presenter и все доступные `answer_list`; недоступные ответы не
сериализуются. Stateless scene может строиться без записи. До
принятия stateful scene использует offer session, но не создаёт quest run.

`ChooseAnswer` передаёт session/node/answer/revision/command token и под lock:

1. отклоняет stale node или несовместимую revision;
2. проверяет, что answer является прямым child текущего screen, и повторно
   проверяет его conditions, даже если клиенту ранее был отправлен этот answer;
3. находит или один раз создаёт `DialogueDecision` для check/choice;
4. применяет typed effects, objective/outcome changes и новый checkpoint;
5. пишет outbox и commit-ит одну UoW;
6. возвращает projection только после commit.

Закрытие клиента ничего не откатывает. До нажатия ответа нет decision; после
нажатия reconnect возвращает уже committed outcome. Несколько NPC используют
разные scene sessions, а не один cursor на весь run. Если permanent world
outcome обесценил открытую сцену, следующий answer получает `stale_dialog`.

Probability snapshot в wire и в решении строится одним evaluator. Attempts
ограничиваются authored policy и activation token; reopen никогда не создаёт
новую попытку. Нормативная спецификация находится в
[DIALOG_SEMANTICS.md](DIALOG_SEMANTICS.md).

## Board, item-hosted episode, service и activity

`OpenInteractionBoard` сначала разрешает host (NPC/item/AREA/object), затем из
одного snapshot собирает quest, standalone dialog, activity и service entries.
Из того же snapshot resolver выбирает conditional host presentation:
title/portrait, `boardIntro` при непустом board или `emptyBoardText` при пустом.
Текст intro не берётся из первой строки и не наследуется от quest description.
Открытие item-hosted rotating dialog сохраняет выбранный episode до projection,
поэтому повтор/open/reconnect не выбирает другой разговор.

Standalone dialog использует ту же atomic answer transition, но idempotency
scope принадлежит `DialogSession/InteractionEpisode`, а не выдуманному quest
run. Travel создаёт `ServiceInvocation` со snapshot цены, duration, presenter и
destination. Activity challenge меняет `ActivityProgress`; отдельный claim
меняет `RewardClaimTrack`. Их транзакции и cooldown namespaces не смешиваются.
Подробнее: [INTERACTION_HUBS_AND_SERVICES.md](INTERACTION_HUBS_AND_SERVICES.md).

Book projection отдельно строит согласованный trio quest list/targets/counters.
`JournalProjection` превращает единственный stable active stage в один current
target, а requirements objective stage — в counters/текст этой цели. Gate,
choice и turn-in stage дают target без counters; технические nodes схлопываются
атомарно. Будущие nodes не проецируются.
Favorites/selected/expanded не меняют run; tracked quest —
отдельная user preference `0..1`. Полный mapping находится в
[TEXT_SURFACES_AND_QUEST_UI.md](TEXT_SURFACES_AND_QUEST_UI.md).

Journal projection также публикует presentation metadata текущей цели для
мира. `relatedMonsterCatalogIds` позволяет клиенту отметить монстров, связанных
с избранными и tracked-квестом. Стабильные requirement counters могут управлять
видимостью перехода, NPC или hotspot через диапазон `min..max`. Это подсказки и
видимость, а не authorization: direct command повторно проверяет run, stage,
counter range, location и actor на сервере.

Отдельная `QuestAvailabilityProjection` питает legacy-маркеры новых квестов у
NPC и на региональной карте. Она компилируется из того же release snapshot и
typed conditions, что board resolver; это не независимый источник истины и не
authorization decision клиента.

Выбираемая награда принимает `award_id`, проверяет его против актуального
`award_list` и одной UoW сохраняет selection, выдаёт package и завершает
turn-in. Обычная quest reward использует capacity policy `inventory_overflow`;
capacity failure остаётся допустимым для transforms, если это явно настроено.

## Составной progress и graph closure

Run хранит один stable active stage. Если это objective stage, он хранит
requirement progress: несколько members одной цели (например NPC A/B/C) могут
обновляться независимо и в любом порядке. Одно доменное событие может совпасть
с несколькими requirements разных активных квестов, но не создаёт несколько
текущих целей внутри одного run.

После применения matches движок вычисляет closure до fixed point:

1. пересчитать completion expression текущего objective;
2. при завершении зафиксировать finished target snapshot;
3. выбрать и активировать ровно один downstream node/branch;
4. добавить on-complete effects в детерминированном authored order;
5. повторить для мгновенных gate/reward/end transitions, пока переходов нет.

Validator запрещает instantaneous infinite loops.

## Branching

Choice фиксирует стабильный `optionId`. Conditions проверяются в момент выбора
под тем же lock, что запись решения. Неактивные ветки не создают objective rows.

Completion `any` обязан иметь alternative policy:

- `close`: остальные alternatives становятся skipped;
- `cancel_with_cleanup`: temporary assets alternatives очищаются.

Продолжать скрыто считать проигравшие alternatives после закрытия current
target в baseline запрещено: это создало бы невидимую вторую цель. Если такой
оригинальный сценарий найдётся, он потребует отдельной доказанной модели.

Implicit выбор по порядку массива запрещён.

### Атомарный decision/outcome transition

Если choice или milestone commit permanent outcome, одна UoW выполняет:

1. проверку active option/conditions и idempotency transition;
2. запись run decision;
3. закрытие/активацию graph веток;
4. commit named outcome bundle;
5. terminal assets/unlocks/history, если это terminal transition;
6. запись dirty keys всех затронутых проекций;
7. after-commit realtime notifications.

Outcome bundle не исполняется циклом независимых `SET_FLAG`. Если succession
содержит `old_leader=dead` и `new_leader=forge`, оба факта видны вместе либо не
видны вовсе. Replayed answer/turn-in возвращает прежний результат.

## Party progress

Party service предоставляет immutable snapshot на момент события. Quest engine
не читает party tables напрямую и не запоминает party как владельца run.

Для каждого кандидата проверяются:

- у героя есть подходящий active run/revision;
- objective активен;
- policy разрешает shared credit;
- герой удовлетворяет area/instance/alive/online/participation filters;
- event ещё не применён к его run.

Каждый герой получает собственный progress и собственные quest items/rewards.
Смена party после события не отнимает уже выданный credit. Один kill может
двигать несколько квестов каждого участника.

Нельзя использовать «лидер двигает progress всем» или один общий party row:
такая модель ломается при выходе из группы, разных ветках и разных revisions.

## Cancellation

`CancelQuest`:

1. проверяет `cancelPolicy.allowed`/wire `no_refuse`;
2. блокирует run;
3. находит asset ledger и personal fact cleanup declarations;
4. через public ports изымает quest-bound items/reservations/effects;
5. удаляет operational objective/dialog/waiting state;
6. пишет history outcome `cancelled` с reason;
7. помечает run terminal;
8. пересчитывает board/journal/markers;
9. after commit отправляет только необходимые notifications.

Если quest-bound stack был смешан с обычным stack, ledger обязан сохранять
quantity attribution. Пока inventory не может гарантировать attribution,
публикация такого grant/cancel contract отклоняется; удалять весь artikul
запрещено.

Отмена не откатывает произвольные permanent rewards и внешние действия игрока.
Любое reversible изменение должно быть заранее объявлено quest-owned.

## Потеря и использование quest assets

Inventory публикует событие с `itemInstanceId`, `artikulId`, количеством и
причиной: `drop`, `sell`, `trade`, `consume`, `expire`, `destroy` или operator
action. До мутации inventory запрашивает policy только для instance/count,
зарегистрированных в quest asset ledger:

- `deny_removal` останавливает запрещённую операцию;
- разрешённая потеря коммитится вместе с обновлением ledger;
- после commit/в той же orchestration UoW quest engine пересчитывает зависимые
  `owned` objectives и планирует authored recovery transition.

Обычный предмет того же artikul, не принадлежащий run, не получает quest policy.
Если stack содержит смешанное происхождение, inventory обязан уметь списать и
атрибутировать конкретное количество; иначе такой authored contract не
публикуется.

### Атомарное «использовать → продолжить → начать бой»

Одна команда interaction выполняет:

1. lock hero/run/item;
2. проверку active node, area/copy/target и живого asset;
3. consume/reservation предмета;
4. запись run fact и progress transition;
5. создание idempotent fight-start intent/outbox;
6. commit;
7. старт RAM fight after commit;
8. dirty book/area/inventory projections.

Если проверка не прошла, item не consume. Если процесс упал после commit,
fight-start intent retryable и не требует вернуть предмет. Повтор команды не
создаёт второй бой. Победа/поражение применяют authored edges; они не могут
самостоятельно догадаться, надо ли повторно выдавать использованный item.

### Переоткрытие graph

Recovery transition не «отматывает весь квест» автоматически. Definition
указывает reset boundary. Движок:

- закрывает downstream nodes, зависящие от потерянного asset/fact;
- очищает только их temporary effects/assets;
- сохраняет уже выполненные requirements текущей составной цели;
- переоткрывает acquisition/recovery node;
- инвалидирует старые waiting/fight intents этой ветки;
- пересчитывает projections.

Validator проверяет, что recovery path достижим и не позволяет бесконечно
фармить permanent reward через повторную выдачу.

## Repeatability и cooldown

Completion закрывает run и создаёт history. Для repeatable quest projection
показывает `finished/cooldown`, пока `availableAt > now`. После cooldown новый
accept создаёт новый run/cycle; старый не переиспользуется.

Catch-up выполняется request-time или общим scheduler/outbox механизмом, но
источником истины остаётся timestamp. Перезапуск процесса не сдвигает cooldown.
Cooldown может быть часом, днём, неделей или любым validated duration.

## Personal world state

Quest effect не изменяет authored `world` content. Он пишет персональный факт
героя. World projection объединяет active release и personal facts:

- видимость NPC/object;
- альтернативный hotspot/action;
- открытый переход;
- персональная доступность магазина;
- presentation сообщения.

Fact имеет owner run/permanent policy. Cancel очищает только declared owned
facts. Permanent fact после completed run остаётся и может быть prerequisite
следующих квестов.

World projection разрешает actor через стабильную world role/actor identity,
а не только hardcoded NPC id. Personal outcome может:

- скрыть, показать или заменить actor;
- сменить holder роли, например `long_knives_leader`;
- выбрать variant hotspot/action;
- сменить board/dialog scene и markers;
- открыть/закрыть downstream entry points.

Все эти поверхности читают один outcome snapshot. После commit invalidation
охватывает area, map, NPC board/dialog, journal/targets и quest availability.
Открытый до commit устаревший dialog cursor отклоняется и запрашивает новую
проекцию; он не позволяет поговорить с уже исчезнувшим NPC.

Committed permanent outcome не принадлежит отменяемому run asset ledger.
Если definition использует preview до milestone, preview обязан быть явно
run-owned и иметь cancel cleanup. Семантика сложных примеров разобрана в
[CASE_STUDIES.md](CASE_STUDIES.md).

## Failure и expiry

До решения QR-01 нет отдельного wire `failed`. Поддерживаются:

- fight loss edge;
- reset objective/group;
- recovery branch;
- item expiry → inventory event → owned progress уменьшается;
- cancellation игроком/оператором;
- terminal internal failure только как future capability.

Если позднее вводится terminal failure, definition обязано указать history,
assets cleanup, retry policy, board/journal projection и client representation.

Expiry конкретного item/effect instance сериализуется с use/reissue по тому же
hero/run/asset lock. Late events несут generation token и не могут продвинуть
новый progress scope. Scheduler является только способом доставки события;
timestamp и request-time catch-up остаются источником истины. Подробности:
[TEMPORARY_ASSETS_AND_EFFECTS.md](TEMPORARY_ASSETS_AND_EFFECTS.md).

## Read projections

Все поверхности строятся из одного snapshot run/definition:

- NPC board + icons;
- dialog scene/answers/award choice;
- book quest list;
- target list;
- counter list;
- finished history;
- area config/hotspots;
- map markers;
- realtime dirty updates.

Нельзя независимо вычислять «готовность» в board, journal и dialog. Projection
service получает нормализованный `QuestRunView` и маппит его на разные wire DTO.

## Fail-fast

Runtime не должен встретить неизвестный objective/effect/condition в active
revision: это обязан остановить validator/materialization. Если нарушение всё
же произошло, команда завершается диагностируемой внутренней ошибкой, а не
пропуском handler.

Missing NPC/bot/artifact/area/reward reference отклоняет candidate целиком.
Отсутствующий обязательный public port блокирует composition startup.
