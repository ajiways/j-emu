# Quest engine: проектный пакет

> **Статус:** план. Документы в этом каталоге не описывают возможности
> текущего runtime и не делают существующий модуль `quests` production-ready.
> Проверенная текущая реализация по-прежнему описывается в
> [`docs/modules/QUESTS.md`](../../modules/QUESTS.md).

## Зачем нужен отдельный проект

Текущий `j-emu` содержит экспериментальный quest slice, а старый `server` —
более широкий, но незавершённый и багованный runtime. Ни один из них не
является архитектурным baseline. Цель проекта — спроектировать общий движок,
на котором можно:

- переносить оригинальные квесты Jugger;
- создавать новые квесты без per-quest production code;
- проходить линейные, составные и ветвящиеся сценарии;
- подключать новые типизированные условия, события и эффекты;
- валидировать определение до публикации;
- позднее построить понятный визуальный редактор поверх того же контракта.

Проект намеренно начинается с семантики и runtime, а не с UI и не с переноса
массового контента.

## Принятые продуктовые решения

1. Проектируется общий движок, а не только цепочка уровней 1–15.
2. Важны корректное поведение и точный клиентский wire; внутренняя реализация
   не обязана повторять оригинальный сервер.
3. Оригинальные и новые квесты являются равноправным authored content.
4. Ветки и составные цели обязательны. В одном run у квеста ровно одна текущая
   player-facing цель; она может требовать несколько действий, например
   поговорить с NPC A, B и C в любом порядке.
5. Один доменный факт может продвинуть несколько активных квестов.
6. Повторяемость задаётся cooldown, а не специальным типом «daily».
7. Событийные кампании и расписания остаются отдельной будущей системой.
8. Изменения мира по умолчанию персональны для героя.
9. Party progress конфигурируется на квесте/цели; награда и quest loot каждого
   героя остаются персональными.
10. Отмена полностью сбрасывает run и изымает принадлежащие ему quest assets.
11. Опубликованный квест архивируется, но его история у героев сохраняется.
12. Несовместимое изменение определения может отменять активные runs явной
    publish policy; скрытой автоконвертации нет.
13. Произвольный исполняемый script в контенте запрещён. Расширение идёт через
    статически зарегистрированные типизированные conditions/objectives/effects.
14. Dwar разрешён как conceptual fallback, но каждое решение получает
    provenance.
15. Экран NPC/предмета — универсальный interaction board: он может содержать
    квесты, обычные цикличные разговоры, магазин, склад, перевозку и активности.
16. Quest runtime переиспользует диалоги и effects, но не владеет состоянием
    всех услуг и активностей: для них существуют отдельные lifecycle aggregates.
17. Обычная quest reward не блокируется полным рюкзаком и может переполнить его.
18. Основных профессий одновременно не более одной собирательной и одной
    производящей; дополнительные профессии выдаются независимо.
19. Host board intro (`npc_description`) является отдельным условным текстом,
    не названием NPC, не label строки и не первой репликой диалога.
20. Избранное, один отслеживаемый квест и выбранный квест в книге — три разных
    UI-состояния; они не принадлежат `HeroQuestRun`.
21. Все authored тексты являются typed rich content, но macro capability
    проверяется отдельно для каждой client surface; hash, raw request и JS
    function не доступны обычному автору.

## Карта документов

| Документ                                                             | Канонический вопрос                                         |
| -------------------------------------------------------------------- | ----------------------------------------------------------- |
| [EVIDENCE.md](EVIDENCE.md)                                           | чему верим и как обращаемся с неизвестным                   |
| [CLIENT_WIRE_CONTRACT_V1.md](CLIENT_WIRE_CONTRACT_V1.md)             | точный board/dialog/book contract клиента и `reg_6lvl`      |
| [OPEN_DECISIONS.md](OPEN_DECISIONS.md)                               | что ещё неизвестно и какой slice это блокирует              |
| [DOMAIN_MODEL.md](DOMAIN_MODEL.md)                                   | какие сущности и состояния существуют                       |
| [CURRENT_SYSTEM_AUDIT.md](CURRENT_SYSTEM_AUDIT.md)                   | что в текущем j-emu переиспользуем и что заменяем           |
| [TARGET_ARCHITECTURE.md](TARGET_ARCHITECTURE.md)                     | компоненты, транзакции, события и направления зависимостей  |
| [PERSISTENCE_MODEL.md](PERSISTENCE_MODEL.md)                         | целевые таблицы, ключи, locking и exactly-once              |
| [AUTHORING_LANGUAGE.md](AUTHORING_LANGUAGE.md)                       | что может выразить определение квеста                       |
| [AUTHORING_SCHEMA_V1.md](AUTHORING_SCHEMA_V1.md)                     | нормативная форма первого authoring contract                |
| [EVENT_CONTRACTS_V1.md](EVENT_CONTRACTS_V1.md)                       | команды, события, payload и retry identity                  |
| [REGISTRY_CONTRACTS_V1.md](REGISTRY_CONTRACTS_V1.md)                 | conditions, requirements, effects и operations              |
| [CAPABILITY_PAYLOADS_V1.md](CAPABILITY_PAYLOADS_V1.md)               | точные payload built-in conditions/requirements/effects     |
| [COMPILER_PIPELINE_V1.md](COMPILER_PIPELINE_V1.md)                   | validation, compilation, indexes и digests                  |
| [TRANSITION_ENGINE_SPEC_V1.md](TRANSITION_ENGINE_SPEC_V1.md)         | детерминированный алгоритм переходов и graph closure        |
| [APPLICATION_API_V1.md](APPLICATION_API_V1.md)                       | facade commands/queries/workers, errors и security          |
| [DIALOG_RUNTIME_SPEC_V1.md](DIALOG_RUNTIME_SPEC_V1.md)               | board, sessions, answers, checks, close/reconnect           |
| [INVENTORY_PROVENANCE_V1.md](INVENTORY_PROVENANCE_V1.md)             | lots, quest assets, consume/cleanup и overflow              |
| [OPERATIONS_AND_WAITS_V1.md](OPERATIONS_AND_WAITS_V1.md)             | durable operations, fact outbox, leases и timers            |
| [ENCOUNTER_COORDINATOR_V1.md](ENCOUNTER_COORDINATOR_V1.md)           | persistent quest binding поверх RAM combat                  |
| [REWARDS_AND_OUTCOMES_V1.md](REWARDS_AND_OUTCOMES_V1.md)             | atomic rewards, professions и permanent outcomes            |
| [REPEAT_ACTIVITIES_SERVICES_V1.md](REPEAT_ACTIVITIES_SERVICES_V1.md) | repeat runs, сферы и travel services                        |
| [PARTY_PROGRESS_V1.md](PARTY_PROGRESS_V1.md)                         | eligibility, fan-out и персональные результаты              |
| [AUTHORING_API_V1.md](AUTHORING_API_V1.md)                           | server contract будущего редактора                          |
| [IMPLEMENTATION_PLAN_QE00_QE01.md](IMPLEMENTATION_PLAN_QE00_QE01.md) | удаление прототипа и первый новый vertical slice            |
| [IMPLEMENTATION_PLAN_QE02_QE03.md](IMPLEMENTATION_PLAN_QE02_QE03.md) | graph interpreter, event router и первые effects            |
| [IMPLEMENTATION_PLAN_QE04_QE06.md](IMPLEMENTATION_PLAN_QE04_QE06.md) | board/dialog, assets, waits, AREA и encounters              |
| [IMPLEMENTATION_PLAN_QE07_QE11.md](IMPLEMENTATION_PLAN_QE07_QE11.md) | rewards, repeat, party, rollout и authoring API             |
| [DIALOG_SEMANTICS.md](DIALOG_SEMANTICS.md)                           | как работают сцены, выход, RNG, цвета и иконки              |
| [INTERACTION_HUBS_AND_SERVICES.md](INTERACTION_HUBS_AND_SERVICES.md) | как работают board, предметные диалоги, travel и activities |
| [TEXT_SURFACES_AND_QUEST_UI.md](TEXT_SURFACES_AND_QUEST_UI.md)       | где показывается каждый текст, книга, tracker и избранное   |
| [RICH_CONTENT_AND_MACROS.md](RICH_CONTENT_AND_MACROS.md)             | как работают текст, ссылки, иконки, navigation и fallback   |
| [DISCOVERY_CHECKLIST.md](DISCOVERY_CHECKLIST.md)                     | как системно находить забытые quest capabilities            |
| [INTERACTIONS.md](INTERACTIONS.md)                                   | как настраиваются use/AREA outcomes, waiting и тексты       |
| [ASSET_TRANSFORMS.md](ASSET_TRANSFORMS.md)                           | как собирать, сдавать и преобразовывать наборы вещей        |
| [TEMPORARY_ASSETS_AND_EFFECTS.md](TEMPORARY_ASSETS_AND_EFFECTS.md)   | как работают expiry, reissue и scoped progress              |
| [STRANGERS_FINDINGS.md](STRANGERS_FINDINGS.md)                       | какие сложные шаблоны найдены в оригинальном контенте       |
| [CASE_STUDIES.md](CASE_STUDIES.md)                                   | чему учат Грого, Путь ведьмака и Бешеный Бык                |
| [RUNTIME_SEMANTICS.md](RUNTIME_SEMANTICS.md)                         | как события, транзакции, party и отмена исполняются         |
| [VALIDATION_AND_TESTING.md](VALIDATION_AND_TESTING.md)               | как доказать корректность движка и контента                 |
| [ROADMAP.md](ROADMAP.md)                                             | в каком порядке выполнять вертикальные срезы                |

## Граница с текущим модулем

Architecture audit завершён: текущий quest runtime не является основой новой
реализации. Запрещено считать обязательными:

- текущую пару `active|done` в `hero_quests`;
- один линейный `goal_ord`;
- один `dialog_cursor` на весь квест;
- текущие authored tables и `QuestDocument`;
- текущий `QuestDesk` как будущий orchestration API;
- восемь синтетических квестов как доказательство полноты.

Сохранять нужно только отдельно доказанные внешние контракты: OA/AMF shape,
клиентские флаги, поведение journal/board/markers, транзакционные гарантии
других модулей и общие правила репозитория. Старый runtime, его таблицы,
synthetic content, progress и тесты поведения удаляются без совместимости;
подтверждённые wire fixtures остаются спецификацией нового adapter.
Подробное обоснование и найденные integration points находятся в
[CURRENT_SYSTEM_AUDIT.md](CURRENT_SYSTEM_AUDIT.md).

## Definition of done всего проекта

Quest engine считается готовым к массовому наполнению, когда:

1. не менее пяти разных tracer quests выражаются одним versioned authoring
   language без проверок по quest key;
2. linear, branch, composite-objective, repeatable, AREA/fight и party-shared paths
   проходят raw-AMF E2E;
3. progress, history, cooldown, personal world state и cancellation переживают
   restart;
4. duplicate/reordered domain events не дают двойной progress или award;
5. закрытие/reconnect в любой точке диалога не позволяет перебросить check,
   повторить effect или потерять committed ветку;
6. invalid graph/reference/effect отклоняет candidate release целиком;
7. несовместимое обновление использует явную migration policy;
8. CEF показывает корректные board, dialog, journal, targets, counters и
   markers на representative flows;
9. новый quest kind/effect добавляется registry entry + validator + executor +
   tests, а не новой веткой в общем switch по конкретному контенту;
10. authoring API может создать новый quest key и провести его через
    draft/candidate/activate без патча БД или файла;
11. документация отличает implemented, partial, researched и planned.
12. один projection contract корректно обслуживает NPC- и item-hosted board,
    standalone dialog, quest scene, activity и service;
13. selectable rewards, paid answers, travel wait и activity claim выдерживают
    duplicate commands, reconnect и restart без двойного списания/выдачи.
14. current target согласованно проецируется в книгу, tracker и мир: related
    monsters, quest markers и counter-gated links используют один snapshot, а
    прямые запросы проходят независимую server authorization.
