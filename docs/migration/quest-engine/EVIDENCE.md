# Quest engine: evidence и неизвестное

> **Статус:** план и правила исследования. Этот документ не объявляет будущие
> механики реализованными.

## Иерархия источников

При конфликте применяется следующий порядок:

1. сохранённые Jugger dumps/session evidence;
2. декомпилированный AS3-клиент и его статические каталоги;
3. извлечённый оригинальный контент Jugger (`strangers`, Pub1, research);
4. наблюдаемое wire-поведение старого `server`, подтверждённое тестом;
5. Dwar source как conceptual reference;
6. подтверждённое владельцем проекта игровое поведение;
7. новое продуктовое решение.

Отсутствие факта в более сильном источнике не доказывает, что механики нет.
Если используется более слабый источник, provenance фиксируется рядом с
контрактом.

## Provenance labels

Каждая capability и спорное поле получают одну метку:

| Метка              | Значение                                                    |
| ------------------ | ----------------------------------------------------------- |
| `JUGGER_WIRE`      | подтверждено реальным OA/AMF dump                           |
| `JUGGER_CLIENT`    | клиент явно читает/отображает поле                          |
| `JUGGER_CONTENT`   | встречается в оригинальном authored content                 |
| `LEGACY_OBSERVED`  | работало в старом `server` и покрыто тестом                 |
| `LEGACY_INTENT`    | было задумано, но не доказано рабочим                       |
| `DWAR_INSPIRED`    | заимствована предметная идея, не wire/schema                |
| `OWNER_CONFIRMED`  | поведение подтверждено владельцем, но точный wire не снят   |
| `PRODUCT_DECISION` | новое осознанное правило j-emu                              |
| `UNKNOWN`          | вопрос открыт; publication/runtime не маскируют его default |

`DWAR_INSPIRED` не разрешает переносить Dwar flags, ids, PHP handlers, HTML
flow или SQL schema.

## Что уже подтверждено клиентом

Декомпилированный `QuestsModel` знает journal-статусы:

- `started`;
- `finished`;
- `available`;
- `unavailable`;
- `cooldown`.

Отдельный клиентский статус `failed` в просмотренном коде не найден. Поэтому
`failed` резервируется как возможный внутренний outcome, но не входит в первый
wire contract. Истечение quest-item сначала моделируется как потеря
достаточности цели, reset ветки или новый доступный recovery path.

Клиентские флаги подтверждают категории:

- `MULTITIME = 1`;
- `MAIN = 32`;
- `DEFAULT = 64`;
- `GROUP = 128`;
- `INSTANCE = 256`;
- `CLAN = 512`.

Это presentation/protocol flags, а не достаточная behavioral model. Например,
`GROUP` не определяет правила party credit без серверной policy.

Клиентский static restriction catalog содержит как минимум `LEVEL`, `MONEY`,
`ARTIFACT`, `ARTIFACT2`, `CLAN`, `KIND`, `AREA`, `QUEST_STATUS`,
`QUEST_COUNTER`, `PROFESSION`, `MISSION`, `RANK`, `ACHIEVEMENT`, `GENDER` и
`SERVER_ID`. Наличие отображения не означает, что каждый predicate нужен в
первой реализации, но authoring language не должен закрывать путь к ним.

`QuestBlockItem` подтверждает точные point bits этого клиента: `START=8`,
`FINISH=16`, `MULTITIME=32`, `REMIND=64`; `point_flags=0` попадает в семейство
finish/point. Для icon column используются quest bits `MULTITIME=1`, `MAIN=32`,
`DEFAULT=64`, `MOVE=4096`, а host action принудительно получает `qst_store`.
Answer presentation также выводится из поведения: `to_fight` даёт fight icon,
наличие `probability` — check icon и диапазонный цвет. Поэтому в authoring
хранится semantic kind, а точные wire flags выводит adapter. Полная таблица и
precedence находятся в
[CLIENT_WIRE_CONTRACT_V1.md](CLIENT_WIRE_CONTRACT_V1.md).

`AnswerData` подтверждает поля `probability`, `waiting_time`, `waiting_title`,
picture/video, `to_fight` и macros. Quest dumps подтверждают HTML-подобную
разметку с `<b>` и `<font color>` в репликах/стадиях. Это evidence для rich
presentation, но не разрешение на произвольный HTML: точный allowlist остаётся
QR-20.

`NPCDialogView` и `GameResponder.NpcAnswer` уточняют семантику answer waiting:
при `waiting_time > 0` request только собирается, но не отправляется до конца
клиентского таймера; cancel закрывает панель без server command. Это не
persisted quest wait. Отдельный live flow `common|waiting → action_finish` в
`reg_6lvl` является server-authoritative prolonged action. Два механизма
проектируются раздельно.

`MacroTextParser` различает `ARTIFACT` (текстовая кликабельная ссылка на
catalog item), `ARTIFACT_IMG` (inline icon с hint) и `ARTIFACT_ITEM` (конкретный
экземпляр). Это три разных authoring intents, а не вариант HTML-цвета.

`AwardPanel` и `NPCDialogView` подтверждают выбираемую награду: ответ с
`award_list` рисует кликабельные предметы, выбор сохраняет `award_id`, а без
выбора клиент не продолжает диалог. Preserved wire «Трагедия призрака /14»
также передаёт `award_list`, затем `award_id`. Поэтому QR-05 закрыт для базового
контракта; stale eligibility и точный порядок piggyback проверяются E2E.

`NPCDialogView` при наличии поля `npc` заменяет данные presenter и перерисовывает
имя/portrait. Смена говорящего внутри одной сцены имеет метку `JUGGER_CLIENT`.

### Тексты host, книга и tracker

`NPCDialogView.setNpcText()` подтверждает три разные поверхности:

- открытый point показывает `point.message` и добавляет `award_message` /
  `target_message`;
- board со строками показывает `npc_description`;
- пустой board показывает `elsetext`.

`QuestBlockItem` отображает `welcome_message` как label конкретной board row.
Следовательно, слово welcome нельзя использовать одновременно для intro NPC и
для строки квеста.

Для открытого point `setNpcText()` передаёт `curPoint.Macroses`; для
`npc_description`/`elsetext` передаёт `null`. Поэтому macro support host intro
не доказан и не входит в parity contract, хотя HTML/rich-text примеры в дампе
есть. В доступной повторной съёмке Акрилона менялся набор board entries, но его
`npc_description` оставался тем же; условный intro пока является product
requirement, а не найденным live примером.

Клиент содержит два macro renderer: quest book/dialog используют legacy
`ChatMessage/MacrosObject`, tracker — `MacroTextParser`. Registries отличаются:
например `RANK/PET/CLAN/RESOURCE_IMG` отсутствуют в legacy switch, а `HR` в
новом parser не является тем же macro. Surface validation обязательна.

`QuestBlockItem` отдаёт macros в board/answer `ChatMessage`, но затем ставит
`Enabled=false`: inline entities визуально отображаются, а клик принадлежит
всей строке. Quest title, counter label и waiting title используют plain
`TFLabel`. Target/summary/reward book text и tracker description macros
поддерживают.

`MAP` напрямую меняет `WorldMapModel.targetLocation`; `NPC` вызывает
`showNpcInfo`. Live NPC macro несёт `area_id`, но исследованный AS3 не использует
его для маршрута. `ACTION` отправляет raw request, `JSFUNC` вызывает JS bridge,
поэтому эти legacy types не могут быть свободным authoring API.

`QuestsModel`, `QuestRightPage` и `TargetDisplay` подтверждают раздельные
`quest.description`, `award_description`, `target.description`, counter
`title/limit/value`, finished target history и progress bars. Live wire
подтверждает trio `book|quest_list`, `book|quest_targets`,
`book|quest_counters` и отдельные macro maps.

Live target 251 содержит HTML + `MAP`; kill target 16 — `BOT` + `MAP`;
`award_description` содержит `ARTIFACT` + `MONEY`. В payload встречаются
локальные `macro_text/title` формы, отличные от catalog title, что подтверждает
необходимость authored label для склонений.

`QuestRightPage` сохраняет для блока «Текущая цель» только один unfinished
target, а tracker получает первый unfinished target. Preserved wire и legacy
server дополняют это до доменного инварианта: finished history + первый
incomplete target, будущие targets отсутствуют. Несколько unfinished rows
являются ошибкой projection; несколько действий живут requirements/counters
одной текущей цели.

Конкретная live-последовательность quest 151: сначала target 251; после его
закрытия появляются finished 251 и current 252; затем 252 закрывается и
появляется 253. После последнего боевого шага видны finished 253/254 и current
255 на сдачу. Это последовательная materialization, а не заранее присланный
список будущих целей.

`reg_6lvl` является основным динамическим regression corpus: один герой прошёл
уровни 1–6, принял 19 квестов, имел до шести active quests одновременно и дал
46 snapshots книги. Он подтверждает accept/turn-in, shadow rows, choice award,
ORATORY, `to_fight`, AREA waits с засадой, совместный finish+accept и точные
формы book trio. Ограничение источника: часть числовых request ids повреждена
HAR-обёрткой, поэтому golden fixtures берут response verbatim, а request
восстанавливают только через предыдущий response и AS3 builder.

Тот же corpus закрывает важное различие presentation/authorization: герой
уровня 5 принял quest 36 с `level_min:7`, а `QuestBlockItem` использует
`level_min` для цвета строки, не для запрета клика. Поэтому `levelHint` не может
неявно компилироваться в availability condition.

При accept quest 36 `book|quest_counters` также содержит counter 23 со значением
1, хотя current target не объявляет его в nested `counters`. Клиент сохраняет
такие rows отдельно, а world controls умеют проверять counters только по id.
Назначение counter 23 как конкретного unlock остаётся inference, но adapter
обязан поддерживать hidden projection counters отдельно от progress bars.

`parseFinishedQuests()` создаёт finished `QuestVO` только из summary/status и
timestamps; targets присоединяются исключительно через `getStartedQuestByID`.
Значит, completed target history — часть активного run UI, а не payload
исторической записи уже сданного квеста.

`QuestVO` хранит `chosen` в local SharedObject `questChosen{id}`; это несколько
локальных favorites. `trackedQuestID` имеет cardinality `0..1`, сохраняется
через `userSavePersonalDetails(watch_quest_id)` и приходит при init. Выбранная
строка правой страницы и expanded tracker card являются ещё двумя отдельными
UI-состояниями.

Есть клиентская непоследовательность: кнопка отслеживания в книге вызывает
`userSavePersonalDetails`, а checkbox на экране принятия только присваивает
`trackedQuestID`. Другого persistence call на этом пути не найдено.

`quest_bot_artikuls` имеет вторую функцию помимо kill matching. Клиент собирает
related monsters только из current target избранных квестов и одного tracked
quest. `MonsterRelationToQuestController` затем меняет monster-link icon,
показывает marker в hunt view и hint с названиями квестов. Это доказывает
отдельную presentation projection текущей цели.

`LocationLinkData` читает `quest_counter_id/min/max`, а hunt
`ExtMappingItem` — `qc_id/min/max`; оба скрывают world control вне диапазона.
`q_object` отдельно добавляет quest marker. В fixtures встречаются реальные
NPC/action links, gated диапазонами, включая `1..1` и `1..11`.

`getQuestCounterByCounterID()` ищет только по numeric counter id, без quest id.
Следовательно, collision двух одновременно опубликованных counters способен
привязать world element к чужому progress. Целевая compilation должна выдавать
collision-free wire ids и использовать один mapping в book/area/hunt.

Доступность нового квеста у NPC вычисляется ещё одним клиентским контуром.
`QuestDataParser` читает static quest catalog; `QuestAvailabilityController`
применяет level/faction/status и restriction items; `NPCLinkRenderer` включает
мигающий `available_quest_icon`, а `NPCFeatureMarker` делает региональный marker
жёлтым и добавляет названия квестов в tooltip. Набор restriction types включает
money, artifacts, clan, area, quest status/counter, profession, mission, rank,
achievement, gender и server id. Это presentation cache, не доказательство
правомерности open/accept.

## Что берём из Dwar

Точечно изучены `quest.lib`, `npc.php`, `restriction.lib`, `bonus.lib` и
`admin/quest.admin` из `/Users/ksuryoga/Projects/dwar_source`.

Полезные идеи:

- point tree и отдельные альтернативные точки при failed restriction;
- restriction engine вместо per-quest условий;
- atomic point completion;
- choice award до завершения точки;
- `started/finished` + cooldown без обязательного failed status;
- отдельные persistent user point records;
- сохранение текущего subpoint после ответа и возобновление с него;
- board visibility как projection от quest/user/point/restrictions;
- явный `NO_REFUSE` и cleanup progress при finish/cancel.

Не переносим:

- проверку kill/loot только через общую статистику вместо first-class progress;
- Dwar bit masks;
- HTML navigation;
- глобальные ids;
- recursive PHP mutation model;
- неограниченные bonus/restriction registries без typed validation;
- удаление finished point history как обязательную семантику.

## Роль старого `server`

Старый runtime и `quest-graph` полезны для составления capability inventory:

- branching `next`/`fail_next`;
- ORATORY probability;
- conditions;
- branch awards;
- multi-board/dialog segment;
- multi-step AREA;
- consume policies;
- fight outcomes;
- editor graph validation и client preview.

Каждая возможность проходит повторный design review. Legacy code не является
dependency и не получает презумпцию корректности. Старые bugs, silent fallback,
dual-write и fixture-runtime не переносятся.

В частности, legacy ORATORY действительно выбирает `next/fail_next`, а cursor
сохраняется. Но cursor, scripts, inventory/facts и fight выполняются отдельными
операциями без единой UoW. Это не доказывает exactly-once: target runtime обязан
фиксировать decision, effects и checkpoint атомарно.

Legacy `GRANT_PROFESSION` и corpus квеста 523 подтверждают выбор одной из трёх
пар «добывающая + производящая», выдачу помощника и первого рецепта. Владелец
уточнил целевой контракт: разрешена любая допустимая пара, основных slots два
(один gathering и один manufacturing), профессии выдаются при turn-in, первый
рецепт приходит предметом, дополнительные профессии выдаются отдельными
квестами. Замена пока исключена из baseline и остаётся частью QR-22.

Рабочая часть legacy dialog flow подтверждает полезную внешнюю форму, но не
его внутреннюю архитектуру:

- `buildNpcQuests` пропускает finished/ineligible/hidden rows до формирования
  `quests` payload;
- `handleSegmentDialog` возвращает реплику в `point.message`, варианты в
  `answer_list` и presenter в `npc` одним `npc|answer` payload;
- обработчик отдельно отклоняет interaction при неверном lifecycle state.

В Dwar `npc.php` использует такой же defense-in-depth pattern: недоступная
quest point не попадает в список, а прямой `action=answer` повторно проверяет
текущий `subpoint`, parent-child связь и restrictions входа/выхода. Это
`DWAR_INSPIRED` подтверждение принципа «filter projection + authorize command»,
а не схема, которую следует копировать.

## Уже существующие primitives в `j-emu`

Текущий экспериментальный runtime не является baseline, но в соседних модулях
есть полезные public primitives:

- chat умеет собирать `ARTIFACT`, `ARTIFACT_IMG` и `ARTIFACT_ITEM` macros;
- character application умеет идемпотентно добавить одну profession license;
- quest script registry уже знает одиночный `GRANT_PROFESSION` и вызывает
  character service.

Этого недостаточно для целевого сценария: authored dialog content пока не имеет
typed inline fragments, одиночный effect не описывает branch bundle с двумя
профессиями/assistant/recipe, а применение нескольких effects не даёт нового
атомарного dialog transition автоматически. При rewrite следует переиспользовать
или обернуть доказанные ports, но не объявлять capability готовой целиком.

## Что добавил корпус strangers

Локальный extract содержит 610 quest threads. Ручная выборка подтверждает
композиции, которых нет в простой линейной модели: multi-item bundles,
player/NPC/AREA transforms, interleaved kill→use/talk, random chained attacks,
fight-loss recovery, progress под временным effect, conditional credit и
branch outcomes. Каталог примеров и ограничения источника находятся в
[STRANGERS_FINDINGS.md](STRANGERS_FINDINGS.md).

Эти находки имеют метку `JUGGER_CONTENT`: они доказывают необходимость
выразительной модели, но не конкретную AMF schema, шанс RNG или точную
последовательность запросов.

Страница strangers о «Голове мертвеца» подтверждает item-hosted разговор:
обычная голова падает с нежити, разговор запускает короткий сценарий с
репутацией Ведьмака; отдельная говорящая голова используется в длинной цепочке
«Смех сквозь слёзы». Приложенный владельцем скриншот подтверждает board самой
головы с несколькими строками разных состояний/разговоров. Политика выбора
очередного разговора и consume point пока `UNKNOWN`.

Страница strangers об Ангальде Д'Аро подтверждает последовательность фантомов
уровней 10–45, сохранение прогресса между посещениями, улучшение сферы обычно
после трёх побед, отдельное получение сферы раз в неделю и двухчасовой срок её
действия. Это `JUGGER_CONTENT` для раздельных `ActivityProgress` и
`RewardClaimTrack`, но не доказательство точной milestone table.

Три проблемные цепочки разобраны отдельно в
[CASE_STUDIES.md](CASE_STUDIES.md). Для изгнания Грого используется сочетание
`OWNER_CONFIRMED` (персональное постоянное исчезновение и полноценная ветка),
`JUGGER_CONTENT` (записанный help path и последующие дружеские квесты) и
`LEGACY_INTENT` (незавершённый факт/overlay старого server). Эти метки нельзя
схлопывать в утверждение, будто legacy реализация когда-либо работала.

## Research backlog

| ID    | Вопрос                                                       | Способ проверки                                            | До какого среза блокирует |
| ----- | ------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------- |
| QR-01 | Есть ли в оригинале terminal failed quest?                   | AS3, locale, quest dumps, content flags                    | только explicit failure   |
| QR-02 | Как истекающий quest-item влияет на цель?                    | artifact lifetime handlers + подходящий content            | timed delivery            |
| QR-03 | Точное значение GROUP/INSTANCE для progress/loot             | AS3 + preserved group/dungeon evidence                     | party slice               |
| QR-04 | Какие client restrictions реально показаны в Jugger content  | decode `quest_info.amf` corpus                             | conditions wave           |
| QR-05 | Choice awards: базовый wire `award_list/award_id`            | **закрыт:** AS3 + preserved quest wire                     | stale/retry E2E остаётся  |
| QR-06 | `no_refuse`, cancel responses и journal history              | AS3 + dumps                                                | cancellation slice        |
| QR-07 | Маркеры при multi-board и branch state                       | Pub1 + AS3 availability                                    | presentation slice        |
| QR-08 | Поведение cooldown на 1h/1d/1w                               | content/dumps; Dwar только fallback                        | repeatability slice       |
| QR-09 | Party credit eligibility: area/copy/alive/range              | product decision, затем CEF                                | party slice               |
| QR-10 | Concurrent publication при active runs                       | architecture decision                                      | versioning slice          |
| QR-11 | Как клиент подтверждает quest recipe/table operation         | AS3 craft models + OA dumps                                | asset transforms          |
| QR-12 | Tool/catalyst durability и момент расходования               | artifacts/actions + representative content                 | advanced transforms       |
| QR-13 | Interleaved kill→use привязан к какому corpse/fight          | AS3 + preserved session                                    | chained interactions      |
| QR-14 | Реальны ли ожидания изготовления в текстовых квестах         | timer/waiting wire dumps                                   | timed transforms          |
| QR-15 | Точный exile flow Грого и момент необратимости               | client/session/content; owner как requirement              | permanent outcomes        |
| QR-16 | Пять могил: timer/RNG, расход кольев и loss recovery         | client/actions + сохранённая сессия                        | Witcher tracer            |
| QR-17 | Бык: password/mask/final loss и момент succession/unlock     | client/session + downstream content                        | succession tracer         |
| QR-18 | Offline-time и countdown wire временных assets/effects       | artifact/effect handlers + OA dumps                        | timed assets              |
| QR-19 | Где Jugger возобновляет pre-accept/active dialog после close | **partial:** close request нет; server resume неизвестен   | dialog parity             |
| QR-20 | Полный каталог point flags, icons, rich-text tags и macros   | **partial:** common point bits закрыты; rare/HTML остались | presentation slice        |
| QR-21 | Формула ORATORY, modifiers и правила повторной попытки       | AS3/content/session; Dwar как fallback                     | skill-check parity        |
| QR-22 | Смена/отказ от профессии, recipes и assistant lifecycle      | quest 523, profession UI/OA и preserved session            | profession quest          |
| QR-23 | Где допустимы text/icon/instance macros и их точный размер   | **partial:** surface matrix; размеры требуют CEF           | inline presentation       |
| QR-24 | Голова: selector history, consume point и новый episode      | item action wire + preserved session                       | rotating item dialog      |
| QR-25 | Сферы: challenges, tier table, defeat/retry и claim cooldown | strangers + client/session                                 | activity tracker          |
| QR-26 | Travel: debit/reserve, interrupt/refund и reconnect payload  | captain/carrier wire + wait handlers                       | travel service            |
| QR-27 | Time-of-day: timezone, границы окна и открытая сессия        | content + server clock/client session                      | scheduled availability    |
| QR-28 | Location unlock: fact, transition visibility и projection    | suitable quest + area/navigation wire                      | access rewards            |
| QR-29 | Стартовый помощник: grant, identity и lifecycle              | quest 523 + profession/assistant wire                      | profession bundle         |
| QR-30 | Даёт ли web-карточка NPC navigation к его location           | CEF/web popup с NPC macro                                  | NPC navigation parity     |

Нерешённый пункт остаётся `UNKNOWN`; он не закрывается удобным default внутри
runtime. В roadmap может быть принят явный `PRODUCT_DECISION`, если Jugger
evidence недоступно.
