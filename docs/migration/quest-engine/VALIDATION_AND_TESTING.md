# Quest engine: validation и стратегия доказательства

> **Статус:** план.

## Слои validation

### 1. Document schema

- обязательные поля;
- строгие unions;
- диапазоны и wire-safe integers;
- stable unique ids;
- unknown fields rejected;
- лимиты размера текста/графа/массива.

### 2. Graph validation

- одна entry point;
- все edges разрешаются;
- reachable terminal path из каждой выбранной ветки;
- нет запрещённых objective cycles; dialog back-edges отдельно проверяются на
  безопасную повторяемость effects;
- bounded repeat имеет положительный конечный limit, terminal body и явный
  reset scope;
- reward reachable;
- `sequence` имеет children; в runtime одновременно materialize только один;
- objective completion `all/any/set/ordered_set` имеет typed requirements;
- completion `any` имеет alternative policy;
- dialog choice ids уникальны;
- каждый renderable screen содержит content/presenter и свой answer set в одном
  projection; отсутствует отдельный wire-screen только для `choice`;
- objective и dialog references согласованы;
- нет instantaneous transition loop.

### 3. Semantic validation

- progress algebra совместима с objective type;
- effect разрешён на hook;
- cancellation cleanup определён для временных grants;
- у каждого asset, нужного незавершённому пути, есть recovery policy;
- recovery reset не переоткрывает уже выданную permanent reward;
- `consumes_asset` связан с конкретным grant/ownership predicate;
- bundle inputs уникальны/нормализованы и имеют допустимые ownership/container
  policies;
- transformation не имеет partial-consume path и каждый output поддерживается
  owning public port;
- `TRANSFORM` objective различает operation provenance от простого владения
  похожим output item;
- repeat policy совместима с history/reward operation key;
- party policy допустима для события;
- no-refuse не имеет доступной cancel action;
- branch reward выдаётся ровно на terminal path;
- quest-bound delivery не потребляет чужое владение;
- named outcome имеет commit policy и атомарный набор effects;
- permanent outcome не объявлен одновременно cancellation-owned;
- actor `hidden/replaced` имеет допустимую projection для каждого hotspot,
  board и dialog entry point;
- succession не допускает одновременно двух holders уникальной world role;
- reported claim/knowledge не используется как world mutation;
- временный asset/effect имеет expiry policy, progress scope и recovery;
- reset по expiry не затрагивает уже выполненные requirements той же цели вне reset scope.
- inline item reference разрешается в catalog/run snapshot и поддерживает
  выбранный text/icon/instance mode на целевой client surface;
- каждый rich fragment имеет supported surface mode либо explicit fallback;
  raw `ACTION/JSFUNC/URL/IMG` запрещены вне privileged extension registry;
- macro placeholder/dictionary согласованы, keys уникальны, а completed target
  сохраняет достаточно semantic data для повторной projection;
- profession grant ссылается на существующий catalog key, совместим с
  selection policy и не удаляет другую профессию неявно;
- profession branch package атомарно выдаёт licenses, assistant/recipe и все
  обязательные dirty projections exactly once.
- profession categories соблюдают cardinality: один primary gathering и один
  primary manufacturing; additional profession не занимает эти slots;
- обычный quest reward явно использует `inventory_overflow`, а transform не
  наследует эту policy автоматически;
- выбираемая награда имеет уникальные `award_id` и ровно один commit selection;
- dialog cycle не позволяет повторить check/cost/reward/fight без нового
  authored activation;
- board entry ссылается на ровно один lifecycle owner: quest, dialog, activity
  или service;
- item selector имеет scope, history policy и persist point;
- travel route имеет cost/duration/arrival/wait projection и interrupt policy;
- activity challenge и recurring claim используют разные idempotency scopes.
- каждый authored text имеет semantic surface; неоднозначное общее поле
  `description/message/welcome` запрещено;
- host presentation variants имеют deterministic priority и обязательный
  fallback для `boardIntro/emptyBoardText`;
- objective journal ссылается на существующие requirements, counter ids
  collision-free во всей одновременно видимой wire projection (включая area
  bindings), а projection создаёт ровно один current target и не раскрывает
  future targets;
- каждый стабильный non-terminal stage имеет journal target; технический
  control node обязан атомарно достигать такого stage или terminal state;
- favorite/tracked/selected/expanded state нельзя изменять quest effect;
- related monster override ссылается на существующий monster catalog id;
- counter-gated world link/object ссылается на опубликованный counter и имеет
  корректный `min <= max`; отсутствие counter закрывает visibility;
- world visibility никогда не заменяет command-side authorization;
- legacy availability-marker projection выводится из authoritative conditions;
  unsupported restriction не теряется молча и не превращается в `available`;

### 4. Cross-content validation

- NPC/bot/artifact/area/store/profession/reputation существуют в том же
  candidate;
- quest prerequisites и start-next references существуют;
- нет запрещённой dependency cycle между квестами;
- point/book ids уникальны в release;
- area hotspots не конфликтуют с travel/NPC/action;
- client presentation assets существуют;
- archived quest reference разрешена только для history condition;
- все consumers named outcome существуют и входят в dependency index;
- удаление/переименование outcome показывает downstream impact и требует
  migration.

### 5. Activation compatibility

- semantic diff старой/новой revision;
- число active runs;
- допустима ли presentation-only активация;
- для incompatible change выбран `reject_if_active` или
  `cancel_active_runs`;
- cleanup plan валиден до блокировки/rollout.

## Capability matrix

До production rewrite создаётся машинно проверяемая матрица:

| Capability         | Provenance           | Current prototype    | Target   | Tracer       | Validator | Test          |
| ------------------ | -------------------- | -------------------- | -------- | ------------ | --------- | ------------- |
| composite `all`    | JUGGER_WIRE/PRODUCT  | partial              | required | talk A/B/C   | semantic  | raw-AMF       |
| branch choice      | JUGGER_CLIENT/legacy | partial              | required | choice quest | graph     | raw-AMF+CEF   |
| arbitrary cooldown | JUGGER_CLIENT/DWAR   | daily-only prototype | required | 1h repeat    | semantic  | clock+restart |

Матрица генерируется/проверяется скриптом там, где возможно. Текстовый статус
без test/reference не считается доказательством.

## Tracer quests

Первый набор не обязан копировать конкретный оригинальный квест, но использует
реальные client surfaces.

### TQ-1 Linear exchange

Talk → grant quest item → deliver/consume → reward. Доказывает asset ledger,
cancel cleanup, journal и exactly-once award. Дополнительные ветки теста:
выбросить предмет → получить replacement; попытаться использовать в неверной
локации → deny без consume; использовать правильно → downstream зависит от
run fact, а не от уже изъятого item.

### TQ-2 Composite patrol

Одна текущая цель: talk A, B, C в любом порядке (`all/set`) → turn-in.
Доказывает составные requirements, три counters внутри одного target,
отсутствие future targets, duplicate event dedup и multi-board markers.

### TQ-3 Branch and join

Choice «бой или договор» → разные objectives/effects/reward packages → общий
эпилог. Доказывает persisted choice, unreachable validation и branch reward.

### TQ-4 AREA quest fight

Area interaction → waiting → quest fight → win/loss edges → personal world
fact. Wrong area/object использует отдельный outcome с plaque/chat; wrong-order
точка запускает authored waiting с другим completion text. Доказывает
persistent waiting, post-commit RAM effect и recovery после проигрыша/restart.

### TQ-5 Repeatable party hunt

Cooldown 1 hour; party members same area receive independent kill progress and
personal loot/reward. Доказывает party snapshot, cycle key и restart cooldown.

### TQ-6 Assemble and use

Собрать A×2, B×1 и C×1 в любом порядке → собрать D у AREA-стола → использовать
D для запуска боя. Варианты того же transform выполняются через NPC и recipe
UI. Проверяются:

- readiness уменьшается после drop/expiry B и восстанавливается authored path;
- при отсутствующем компоненте не списывается ничего;
- require-only tool остаётся, consumable inputs исчезают;
- concurrent drop/transform даёт один согласованный результат;
- duplicate operation id возвращает прежний result без второго D;
- заранее полученный обычный D не закрывает operation-bound objective;
- cancel очищает quest-owned inputs/output, но не обычный инструмент героя;
- full bag/capacity failure не consume inputs;
- encounter появляется только after commit и не дублируется после restart.

### TQ-7 Interleaved lesson

Три раза выполнить `kill one bound target → talk/use about that target`.
Доказывает bounded repeat, iteration token и локальный reset body. Нельзя двумя
kill подряд заранее заполнить будущие итерации, повторно использовать один
corpse/target или после reconnect применить stale action предыдущего шага.

### TQ-8 Permanent personal branch

Упрощённая модель Грого: выбор `friend|exiled` меняет текущую ветку. Friend
оставляет NPC и открывает follow-up; exile сразу скрывает NPC, заменяет хижину
на authored empty interaction и меняет downstream dialog. Проверяются cancel
до/после commit point, reconnect, restart, устаревший открытый dialog,
архивация definition и сохранение ending в history.

### TQ-9 Timed effect scopes

Один effect можно обновить с сохранением progress, другой при expiry сбрасывает
только свой локальный counter и создаёт новую generation. Проверяются offline
catch-up, use на границе времени, duplicate expiry/reissue и late kill event от
старой generation.

### TQ-10 Succession and unlock

Сокращённая модель Бешеного Быка: disguise guard → any-of reagent → deception
claim → multi-side encounter → atomic outcome `bull_dead + forge_leader` →
передача книги → reputation capability unlock. Проверяется отсутствие
промежуточного мира с двумя/нулём атаманов, exactly-once terminal bundle и
downstream board/dialog после restart.

### TQ-11 Unique timed targets

Сокращённая модель могил «Пути ведьмака»: пять уникальных AREA targets и пять
расходуемых кольев. Для каждой могилы timer/outcome выбирает прямое запечатывание
или bound ambush; победа закрывает только породившую encounter могилу. Тесты
покрывают повторный клик, loss/retry, потерю кольев, concurrent interaction,
restart между start/finish и atomic unlock репутации после последней сдачи.

### TQ-12 Stateful dialog and oratory

Pre-accept три экрана → проверка красноречия → разные active-state entries →
fight/effect. Тест закрывает окно до ответа, после ответа, после RNG до получения
response и после restart. Один command/replay всегда даёт один outcome, один
effect и тот же checkpoint; failure нельзя перебросить reopen. Отдельная authored
recovery создаёт новый activation token и только тогда разрешает новую попытку.

Проверяются также пересекающиеся entry conditions, stale открытый dialog,
независимые sessions двух NPC, `restart_on_open` только для чистой сцены,
совпадение показанной и применённой probability, styles/macros и derived
normal/check/fight icons в raw-AMF/CEF. Скрытый answer отсутствует в payload, а
подделанный прямой запрос его id не выполняет transition/effect.

### TQ-13 Profession choice and inline items

Модель квеста Элии: длинное объяснение доступных профессий с
предметами-примерами текстом и иконками → свободный выбор одной gathering и
одной manufacturing
профессии → отдельное подтверждение → atomic grant двух
licenses, подходящего помощника и первого recipe item. Проверяются back/close до
подтверждения, duplicate answer, full bag с успешным overflow, restart после
commit, занятый primary slot без неявной замены, точные
`ARTIFACT`/`ARTIFACT_IMG` macros и profession projections.

### TQ-14 Item-hosted rotating dialog

«Голова» открывает board с несколькими обычными/условными разговорами. Selector
выбирает новый episode по history, но close/reconnect до завершения возвращает
тот же episode. Проверяются item instance identity, consume point, safe dialog
cycle/back, presenter, duplicate answer и отсутствие quest run у чистого
разговора.

### TQ-15 Challenge activity and recurring claim

Серия из шести фантомов с союзниками повышает sphere tier после каждой третьей
победы. Challenge можно продолжить после restart; проигрыш не двигает индекс.
Отдельный claim выдаёт текущий tier один раз за короткий test cooldown. Повтор
claim не выдаёт сферу, а следующий challenge не сбрасывает cooldown.

### TQ-16 Paid travel service

Board перевозчика показывает два направления, condition/location unlock, цену
и время. Выбор создаёт wait с portrait; restart возвращает remaining time;
completion атомарно списывает/resolves reservation и переносит героя. Тесты
фиксируют duplicate start/finish, недостаток денег, interrupt/refund policy и
неподвижность героя до terminal commit.

### TQ-17 Entitlement board

Торговец сначала предлагает платный разговор о складе, затем после атомарной
покупки заменяет entry на `open_storage`, сохраняя рядом квесты и обычный
цикличный dialog. Доказывает общий board resolver и persistent entitlement.

### TQ-18 Text surfaces, journal and tracker

Один host меняет `boardIntro` по reputation и completed quest, не меняя labels
строк. Квест имеет отличный от intro `bookSummary`, reward preview, один
составной current target A/B/C и три counters. После разговора с A его counter
обновляется; после закрытия всей группы target уходит в completed history.
Проверяются raw
`npc_description/elsetext/welcome_message`, book trio, macros, progress bars,
tracker fallback, несколько local favorites и отдельный single tracked quest.

### TQ-19 Rich content surface compatibility

Один semantic content fixture содержит NPC со склонённым label, MAP navigation,
BOT, MONEY, item text, item icon и named item instance. Он проецируется в
dialog point, board row, answer, book summary/reward, current/completed target,
tracker, counter label и waiting title.

Тест фиксирует разные ожидаемые результаты: интерактивные macros на point/book,
визуальные, но disabled macros в board/answer, text fallback в plain labels,
отдельные NPC-info и MAP-navigation actions. Missing payload, unsupported icon,
hash collision и raw `ACTION/JSFUNC/URL` отклоняются до публикации.

### TQ-20 Current-target world affordances

Текущая составная цель требует убить монстра и затем активировать две точки.
Когда квест не favorite и не tracked, journal остаётся корректным, но monster
quest marker не показывается. Favorite или tracking включает marker в monster
link и hunt view с названием квеста. После убийства counter range открывает
первую точку; после её активации скрывает первую и открывает вторую, не создавая
второго unfinished target.

Проверяются согласованные ids в `quest_targets`, `quest_counters`, area links и
hunt mapping, collision двух одновременно активных квестов, dirty refresh после
progress, reconnect и stale direct request. Последний отклоняется сервером даже
при вручную подставленном href.

### TQ-21 NPC availability markers

NPC предлагает несколько квестов с условиями по level, profession, завершённому
квесту и одному динамическому условию. Publication строит board и legacy static
availability records из одного candidate. NPC link и regional-map marker
загораются только при наличии хотя бы одного доступного квеста; tooltip содержит
только их названия.

Тест меняет каждую зависимость, сравнивает marker с server board resolver и
повторяет direct open/accept. Unsupported legacy condition требует explicit
marker fallback или client extension; silently optimistic marker запрещён.

## Test pyramid

### Unit

- graph closure and transitions;
- condition evaluation;
- objective progress algebra;
- effect planning order;
- cooldown/cycle calculation;
- compatibility diff;
- party eligibility;
- deterministic RNG decision persistence;
- dialog entry resolution, resume policy и attempt activation;
- answer pre-submit delay не создаёт session transition/wait до command;
- board entry resolution для NPC/item, dialog cycle safety и episode selector;
- activity tier/claim cooldown и travel quote state machine;

### Integration/PostgreSQL

- hero lock and concurrent events;
- duplicate event/effect/reward uniqueness;
- cancellation asset ledger;
- atomic multi-input transform, capacity failure и concurrent inventory action;
- drop/expire/reissue под concurrent requests;
- atomic consume + transition + fight outbox;
- concurrent/replayed `action_finish`, early finish и process restart внутри
  waiting;
- materialization of immutable revision;
- rollout batches/restart;
- history retention;
- candidate rejection does not move active pointer.
- atomic answer decision + effects + checkpoint и duplicate command replay;
- selectable award, item episode, service invocation и activity claim replay;

### Raw-AMF E2E

- board/answer/book trio/area/fight flows;
- pre-accept resume, probability/to_fight и quest/point marker flags;
- `jump` precedence, presence-sensitive fields и cancelled answer delay;
- piggyback ordering;
- reconnect/restart;
- cancel/no-refuse;
- finished history and cooldown;
- multi-quest progress from one event;
- party progress for two isolated heroes.
- item-hosted board, clickable `award_list`, travel wait и presenter switching.

### CEF

Для каждого нового client surface — один representative manual scenario после
raw-AMF. Проверяются не только отсутствие ошибки, но и icon, button, target,
counter, waiting, marker и history presentation.

## Model-based tests

Graph interpreter получает reference pure model. Property tests генерируют
маленькие acyclic graphs и event sequences, проверяя:

- terminal reward не более одного раза;
- closed node не возвращается active без explicit reset;
- completion `all` не закрывает objective раньше всех required members;
- completion `any` применяет declared alternative policy;
- duplicate event не меняет state;
- event/target token предыдущей repeat-итерации не продвигает следующую;
- cancel всегда завершает cleanup ledger;
- replay persisted events даёт тот же snapshot;
- outcome bundle не наблюдается частично;
- event старой temporary generation не меняет новый progress scope.

Generated graph не заменяет authored tracer tests: он ищет state-machine bugs,
а не доказывает wire/content semantics.

## Prototype deletion gate

Аудит завершён решением удалить старый quest runtime целиком. Перед удалением
сохраняются только raw client fixtures с доказанным внешним поведением; parser,
schema, repositories, `QuestDesk`, synthetic content и их tests не переносятся.

Gate закрыт, когда production graph больше не содержит старых quest imports, а
inventory/store/combat/content проходят собственные tests без quest callbacks.
Точный changeset описан в
[IMPLEMENTATION_PLAN_QE00_QE01.md](IMPLEMENTATION_PLAN_QE00_QE01.md).

## Observability

Обязательные structured events:

- command/event accepted/rejected/duplicate;
- objective transition;
- effect planned/applied/retry/failed;
- reward idempotency conflict;
- cancel cleanup result;
- definition rollout progress;
- projection build failure;
- party credit candidates/accepted/denied reason (sampling для объёма).

Логи не содержат полный authored dialog и secrets. `runId`, `questKey`,
`revisionId`, `heroId`, `eventId`, `correlationId` позволяют собрать трассу.
