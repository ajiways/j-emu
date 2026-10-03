# Quest engine: первый roadmap

> **Статус:** проектная очередь, не канонический execution status общего
> [`../ROADMAP.md`](../ROADMAP.md). После утверждения каждый implementation
> slice переносится туда отдельной capability с dependencies/checkpoint.

Технический planning baseline уже зафиксирован в
[аудите текущей системы](CURRENT_SYSTEM_AUDIT.md),
[целевой архитектуре](TARGET_ARCHITECTURE.md) и
[persistence model](PERSISTENCE_MODEL.md). Реализация нового runtime ещё не
начата.

Первый authoring/runtime contract зафиксирован в
[AUTHORING_SCHEMA_V1.md](AUTHORING_SCHEMA_V1.md),
[EVENT_CONTRACTS_V1.md](EVENT_CONTRACTS_V1.md) и
[REGISTRY_CONTRACTS_V1.md](REGISTRY_CONTRACTS_V1.md). QE-00A/QE-01 разложены на
repository changes и acceptance tests в
[IMPLEMENTATION_PLAN_QE00_QE01.md](IMPLEMENTATION_PLAN_QE00_QE01.md).
Payload catalog, compiler, transition algorithm и facade API также закреплены в
соответствующих `*_V1` документах из [карты проекта](README.md#карта-документов).
QE-02/QE-03 разложены в
[IMPLEMENTATION_PLAN_QE02_QE03.md](IMPLEMENTATION_PLAN_QE02_QE03.md).
QE-04–QE-06 и общие inventory/operations/combat dependencies разложены в
[IMPLEMENTATION_PLAN_QE04_QE06.md](IMPLEMENTATION_PLAN_QE04_QE06.md).
QE-07–QE-11 разложены в
[IMPLEMENTATION_PLAN_QE07_QE11.md](IMPLEMENTATION_PLAN_QE07_QE11.md).

## Принцип очереди

Не создаём «Quest Engine v2» одним изменением. Каждый этап заканчивается
работающим vertical path и сохраняет доказанные client flows. UI редактора не
входит до завершения server authoring API.

## QE-00 — Evidence inventory и characterization

**Цель:** зафиксировать только те client/content контракты, которые новый
движок обязан реализовать. Старый quest runtime не сохраняется.

Работы:

- capability matrix по текущему `j-emu`, старому `server`, client и Dwar;
- автоматический scan старого curated corpus;
- зафиксировать suite TQ-1…TQ-11 и выбрать первые пять implementation tracers;
- pin минимального реально нужного board/dialog/book/area/fight wire;
- дополнить уже выполненный prototype audit конкретными raw-AMF fixtures;
- превратить принятые границы interpreter, event routing и definition version
  binding в ADR только там, где реализация обнаружит новый выбор.

**Exit:** ни одна следующая capability не зависит от undocumented behavior;
есть список внешних контрактов нового движка.

## QE-00A — Удаление экспериментального runtime

**Цель:** освободить кодовую базу от ложной совместимости до создания новой
schema.

Работы:

- удалить `QuestService`, `QuestDesk`, старые repositories/domain helpers;
- удалить старые quest tables следующей миграцией;
- удалить восемь synthetic quests и их специальные validation rules;
- удалить тесты старого поведения, сохранив только отдельно подтверждённые
  client wire fixtures как characterization data;
- убрать quest hooks из inventory/store/combat/composition root;
- оставить quest OA routes явно unavailable до QE-01+, не имитируя успех.

**Exit:** в runtime, composition root и content publication нет импортов старого
quest модуля; чистая БД поднимается без старых quest tables.

## QE-01 — Immutable revision и run identity

**Цель:** отделить definition от попытки героя.

Работы:

- реализовать `quest.v1` schema и закрытые registry contracts;
- immutable `QuestDefinitionRevision` materialization;
- `HeroQuestRun` с `runId/revisionId/cycleKey`;
- history outcome completed/cancelled;
- active/archive definition lifecycle;
- read projection на один линейный characterization quest;
- новая schema создаётся с нуля, без импорта synthetic progress.

**Exit:** новый run pinned к revision; finished history переживает archive и
restart; presentation-only новая revision не переписывает историю.

## QE-02 — Graph interpreter core

**Цель:** заменить `goal_ord + один cursor` общей детерминированной моделью.

Работы:

- nodes `objective/sequence/bounded-repeat/choice/gate/reward/end` и
  completion algebra `all/any/at_least/ordered` внутри objective;
- activation/closure algorithm;
- iteration token и reset body без произвольного graph cycle;
- stable ids, branch decisions;
- dialog graph transition binding;
- graph/semantic validators;
- pure reference model и property tests.

**Exit:** TQ-2, TQ-7 и skeleton TQ-3 выполняются без per-quest code; member
events составной цели в любом порядке дают одинаковый terminal state, а
событие предыдущей repeat-итерации не закрывает следующую.

## QE-03 — Event router и idempotent effects

**Цель:** единый безопасный путь прогресса и последствий.

Работы:

- typed `QuestEvent` envelope для quest-specific projection domain facts;
- subscription index;
- event application dedup;
- effect registry/phases/outbox;
- reward operation ids;
- adapters для TALK, inventory и dialog choice;
- один event двигает подходящие requirements нескольких runs;
- persisted RNG decision для random follow-up/spawn;

**Exit:** duplicate/reordered requests не дублируют progress/award; missing
handler не превращается в success.

## QE-04 — Conditions, board и dialog visibility

**Цель:** prerequisites и presentation из одного snapshot.

Работы:

- condition algebra `all/any`;
- LEVEL, QUEST_HISTORY, QUEST_ACTIVE, FLAG, AREA, ARTIFACT_COUNT;
- entry/answer/edge conditions;
- deterministic state-specific entry resolver с priority/overlap validation;
- board/dialog/journal projection service;
- semantic marker/answer kinds и exact client flag mapping;
- server-side deny reason для audit/direct-request response без публикации
  скрытой строки в board;
- cross-quest dependency validation.

**Exit:** цепочка квестов и conditional branch видимы одинаково во всех
проекциях; unknown condition отклоняет publication.

## QE-04A — Dialog sessions, checks и presentation

**Цель:** выход/reconnect не меняет уже совершённый ответ и не позволяет
перебрасывать красноречие.

Работы:

- scene/entry graph со stable keys;
- offer и run-bound `DialogSession`, независимые sessions разных NPC;
- `resume_checkpoint`, безопасный `restart_on_open` и stateless chatter;
- atomic `ChooseAnswer`: decision + effects + checkpoint + outbox;
- persisted probability/skill decision и authored attempt policies;
- stale dialog/revision/command token protection;
- semantic text style + sanitized legacy rich text + macros registry;
- marker/answer icon projection из semantic intent;
- TQ-12 и raw-AMF/CEF fixtures.

**Exit:** закрытие до ответа ничего не меняет; закрытие после ответа всегда
возвращает тот же outcome; timeout/restart не создают второй roll/effect/fight;
active stage state выбирает правильную реплику и marker.

## QE-04B — Universal board и standalone interactions

**Цель:** один resolver для NPC, предметов и объектов без фиктивных квестов.

Работы:

- `InteractionHost`, `Presenter` и typed board entries;
- quest/standalone dialog/store/storage/activity/service на одном board;
- безопасные dialog cycles/back и per-node presenter override;
- item-hosted `InteractionEpisode` и persisted selector outcome;
- entitlement-based replacement одной строки board другой;
- TQ-14 и TQ-17, raw-AMF/CEF fixtures.

**Exit:** «Голова» переживает close/reconnect без reroll; обычный цикличный
разговор не создаёт quest history; покупка склада согласованно меняет board;
смена говорящего обновляет имя и portrait.

## QE-04C — Text surfaces, quest book и tracker

**Цель:** перестать использовать неоднозначные `message/description/welcome` и
дать каждой клиентской поверхности проверяемый projection contract.

Работы:

- semantic text catalog и exact wire mapping;
- typed rich fragments, macro registry и per-surface capability matrix;
- text/icon/instance item refs, NPC info и MAP navigation как разные intents;
- macro dictionary compiler, fallback/layout/security validation;
- conditional `boardIntro`/`emptyBoardText` host variants;
- отдельные board entry label, screen body, book summary, reward preview,
  target description и counter label;
- один current target на stable active stage, составные requirements и counters;
- trio quest list/targets/counters и completed target history;
- current-target world metadata: related monsters, counter-gated links/objects
  и quest markers;
- derived NPC availability-marker projection для link и regional map без
  ручного дублирования conditions;
- collision-free wire counter ids shared by book and area projections;
- local favorites, one tracked quest, selected/expanded UI state;
- preview fixtures board/dialog/book/tracker;
- TQ-18, TQ-19, TQ-20 и TQ-21.

**Exit:** все поверхности одного квеста показывают предназначенный им текст;
изменение reputation атомарно меняет intro и board snapshot; A/B/C видны одним
согласованным target с тремя counters; favorite не меняет run, tracking не
подменяет favorite; progress согласованно меняет связанные world affordances,
availability marker совпадает с board resolver, а direct request остаётся
защищённым.

## QE-05 — Quest assets, delivery и cancellation

**Цель:** полный reset без удаления чужих предметов.

Работы:

- quest asset ledger/attribution;
- grant/owned/deliver/consume policies;
- multi-item collect/delivery bundles;
- item expiry event;
- authored recovery policies: deny/reissue/reopen/reset/branch/cancel;
- dependency distinction `requires_asset/consumes_asset/requires_fact`;
- cancellation cleanup;
- no-refuse;
- TQ-1.

**Exit:** отмена удаляет все и только ресурсы run, пишет history и возвращает
offer согласно availability; выброшенный/просроченный предмет следует authored
recovery path; wrong-area use не consume; restart/concurrent cancel/reissue
безопасны.

## QE-05A — Atomic asset transformations

**Цель:** выразить «собрать части → использовать вместе/передать/починить» без
per-quest кода и без жёсткой зависимости quest engine от профессий.

Работы:

- общий transaction port для нескольких typed inputs/outputs;
- modes consume/reserve/require-only и quest ownership;
- triggers recipe UI, item use, NPC answer и AREA object;
- objectives `COLLECT_BUNDLE`, `DELIVER_BUNDLE`, `TRANSFORM`;
- guards table/location/profession/equipment/effect;
- persistent operation result и idempotency;
- анализ текущего `CraftService`: извлечь reusable inventory primitive либо
  реализовать совместимый port без дублирования profession rules;
- TQ-6.

**Exit:** компоненты A/B/C собираются в любом порядке, потеря одного корректно
уменьшает readiness, transform списывает весь набор или ничего, retry не
дублирует output, а NPC/player/AREA варианты проходят один общий semantic test
suite.

## QE-06 — World, AREA и combat

**Цель:** сложные игровые сценарии без script escape hatch.

Работы:

- personal world facts/projection;
- ENTER_AREA и INTERACT_AREA;
- typed interaction outcome cases и response channels;
- persistent waiting с authored duration/start/complete/cancel presentation;
- asset timing keep/reserve/consume-on-start/consume-on-complete;
- quest encounter binding;
- chained encounter и binding recent target/corpse к item-use interaction;
- progress scope к временному effect instance и partial reset при expiry;
- temporary asset/effect generations, expiry policies и request-time catch-up;
- win/loss edges;
- START_QUEST_FIGHT after-commit outbox;
- TQ-4.

**Exit:** проигрыш открывает authored recovery/reset path; RAM fight loss при
restart не выдаёт награду и не портит run; wrong context исполняет выбранный
outcome; restart/replayed `action_finish` не дублируют consume/progress/fight.

## QE-06A — Personal outcomes и succession

**Цель:** сделать полноценные персональные развилки частью модели мира, а не
набором несвязанных флагов.

Работы:

- separate run decision, reported claim/knowledge и permanent outcome;
- named atomic outcome bundle с commit policy;
- actor disposition visible/hidden/replaced;
- stable world roles и succession;
- world variants для hotspot/board/dialog/markers/availability;
- dependency/impact index для consumers outcome;
- stale dialog invalidation;
- TQ-8 и world-state часть TQ-10.

**Exit:** friend/exile Грого переживает restart и согласованно меняет все
проекции; outcome смерти Быка атомарно назначает Форга атаманом; отмена не
откатывает уже committed permanent outcome; редакторский API может показать
весь downstream impact выбора.

## QE-07 — Rewards и branch outcomes

**Цель:** разные концовки и награды.

Работы:

- named reward packages;
- choice award/award selection по подтверждённому `award_list/award_id`;
- exp/money/items/reputation/profession/recipe/assistant ports;
- branch-specific profession bundles, category cardinality и занятые slots без
  неявной замены;
- quest reward delivery `inventory_overflow`;
- exactly-once terminal grant;
- TQ-3 полностью;
- terminal capability/reputation unlock как часть outcome bundle;
- TQ-11 terminal unlock и reward.
- TQ-13 profession pair + assistant + recipe exactly once.

**Exit:** каждая reachable ветка имеет валидный end/reward; повторный turn-in
не меняет героя; репутация закрытого трека не начисляется до атомарного unlock.

## QE-08 — Repeatability и history

**Цель:** произвольный cooldown без специальной daily-модели.

Работы:

- once/immediate/duration cooldown;
- новый run/cycle;
- current cooldown и finished history projections;
- archive behavior;
- request-time catch-up;
- QR-08.

**Exit:** 1h/1d/1w сценарии проходят FakeClock + restart; каждая попытка имеет
отдельную history и idempotency namespace.

## QE-08A — Long-lived activities и services

**Цель:** сценарии «Сфер мага» и перевозчиков без маскировки под repeat quest.

Работы:

- `ActivityProgress`, bounded challenge sequence и authored allies;
- отдельный `RewardClaimTrack`, tier snapshot и arbitrary claim cooldown;
- `ServiceInvocation`, route quote, persistent wait и arrival commit;
- price reservation/debit, interrupt/refund и reconnect policies после QR-26;
- location/time-window conditions как внешние predicates;
- TQ-15 и TQ-16.

**Exit:** challenge и reward claim имеют независимый progress/cooldown;
duplicate/restart не создают второй бой, sphere или relocation; travel wait
восстанавливает provider-specific presentation и завершается атомарно.

## QE-09 — Party progress

**Цель:** современный настраиваемый shared credit с персональными runs.

Работы:

- PartySnapshot port;
- personal/same-area/same-instance/participants policies;
- filters alive/online/participated;
- fan-out event under independent hero locks;
- personal quest loot/reward;
- TQ-5.

**Exit:** два героя с разными progress/revisions корректно получают или не
получают один fight event; выход из party не откатывает credit; нет double
loot.

## QE-10 — Definition rollout

**Цель:** безопасно менять квест с активными игроками.

Работы:

- semantic/compatibility digest;
- presentation-only classification;
- policies `reject_if_active` / `cancel_active_runs`;
- retiring gate для новых accepts;
- resumable batch cancellation;
- rollout audit/status.

**Exit:** crash в середине rollout восстанавливается; ни один run не исполняет
смешанную revision; cleanup failures видимы и retryable.

## QE-11 — Server authoring API

**Цель:** сервер готов к будущему user-friendly редактору.

Работы:

- создание нового quest key;
- server-side allocation/reservation book/point ids;
- list/read/archive;
- catalog lookups NPC/bot/artifact/area/quest/fact;
- catalog lookups profession/recipe/assistant и inline macro capabilities;
- draft validation + graph issues;
- dialog state simulator, forced success/failure preview и reopen preview;
- exact client preview для styles/macros/markers/answer kinds;
- candidate diff/impact/active-run count;
- rollout policy API;
- audit.

**Exit:** TQ-1 и TQ-13 создаются с нуля через operator HTTP, публикуются и
проходятся без file/DB patch. UI всё ещё не требуется.

## После server roadmap

Только затем планируется `j-content-editor`:

1. каталог и wizard;
2. form/screen editor для линейного квеста;
3. semantic graph для ветвления и составных objective requirements;
4. scene/entry graph, state matrix и «закрыть/открыть снова» preview;
5. client preview цветов, macros, markers и answer icons;
6. issue navigation;
7. candidate diff/publish/rollout UX;
8. playtest tools с управляемым RNG.

Editor layout хранится у editor, semantic document — у `j-emu`; backend
editor обращается только через `/operator/*`.

## Что намеренно позже

- seasonal/global event scheduler;
- clan-owned shared run;
- server-global world mutation;
- terminal failed quest без evidence;
- arbitrary cyclic graphs;
- hot migration map активного run между graph revisions;
- script sandbox;
- массовый импорт старого `server` контента.
