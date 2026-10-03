# Quest engine: аудит текущего j-emu

> **Статус:** технический planning baseline, 2026-10-03. Текущий quest runtime
> не является основой новой реализации. Он рассматривается только как карта
> существующих wire routes, интеграций и конфликтующих таблиц.

## Вывод

j-emu уже имеет нужный инфраструктурный фундамент: PostgreSQL/Drizzle, вложенную
`UnitOfWork`, module factories, application ports, immutable content releases и
candidate activation. Новый quest engine должен использовать эти механизмы, а
не создавать вторую БД, event store или отдельный редакторский lifecycle.

Текущие `QuestService` и `QuestDesk`, их таблицы, synthetic content и тесты
удаляются отдельным первым implementation slice. Никакого dual-run,
совместимости состояния или переходного adapter между двумя quest runtimes не
будет. Сохраняются только общие OA command routes и подтверждённый client wire,
которые заново подключаются к новому facade.

## Что уже можно переиспользовать

| Возможность                              | Текущее место                                  | Решение                                   |
| ---------------------------------------- | ---------------------------------------------- | ----------------------------------------- |
| Общая транзакция модулей                 | `PostgresDatabase.run()` + `AsyncLocalStorage` | использовать для hero/run/effects         |
| Блокировка героя                         | `CharacterService`/`PostgresHeroRepository`    | герой является первым mutex               |
| Immutable content release                | `content.releases/release_entries`             | quest revision входит в общий release     |
| Draft/candidate/validate/activate        | `ContentEditorService`                         | расширить quest schema/validator          |
| Atomic materialization + activation      | `ContentPublicationService`                    | добавить quest compiler/materializer      |
| Каталоги предметов/ботов/профессий       | public catalog ports                           | только typed references                   |
| Inventory/character/profession mutations | public application services                    | вызывать effects через ports              |
| Fight terminal notification              | `FightTerminalObserver`                        | заменить на устойчивый encounter contract |
| OA registry и typed commands             | `jugger-wire` registry                         | сохранить thin decode/encode boundary     |
| Long poll и UI wake                      | `ProgressNotifier`, outbox, wake               | post-commit presentation only             |

Content publication уже блокирует singleton active release, проверяет checksum,
materialize-ит candidate и активирует его в одной PostgreSQL-транзакции. Это
правильная точка для компиляции quest graph, wire identities, host bindings и
availability projections.

## Почему текущий quest runtime не расширяем

Текущая модель рассчитана на небольшой демонстрационный slice:

- run идентифицируется `(heroId, questKey)`, поэтому нет нескольких cycles;
- статусы только `active|done`;
- один глобальный `dialogStep/dialogCursor` на весь квест;
- goals идут линейным `goalOrd`;
- dialog — линейный массив шагов с частными `toFight/scripts`;
- waiting хранится колонками прямо в `hero_quests`;
- branching, decision attempts, named outcomes и per-scene resume отсутствуют;
- release revision не закреплена в run;
- completed target snapshots и полноценная history отсутствуют;
- временные quest assets не имеют provenance ledger;
- event/effect receipts отсутствуют.

`QuestService` одновременно решает availability, lifecycle, progress, dialog,
waiting, daily reset и journal snapshot. `QuestDesk` дополнительно выполняет
effects, запускает бои, строит wire и вызывает чужие application services.
Добавление новых возможностей увеличивало бы связанность одного orchestration
switch вместо расширения registries.

В `collectQuestIssues()` есть обязательные synthetic keys, NPC и конкретные
action/item ids. Это characterization validator текущего slice, а не общий
валидатор контента. Новая публикация не должна содержать требований вроде
«обязан существовать `q_engine_area`».

## Найденные integration points

| Источник                | Текущее подключение                    | Что требуется целевой системе                     |
| ----------------------- | -------------------------------------- | ------------------------------------------------- |
| NPC/item board и answer | `QuestDesk.execute`                    | `InteractionBoardQuery` + `DialogCommand`         |
| Использование предмета  | последующий `afterBagChange`           | событие `item.used` с instance/provenance/outcome |
| Выбрасывание/продажа    | пересчёт количества после mutation     | `item.removed` и recovery/asset policy            |
| Экипировка              | `recordEquip(artikulId)`               | `item.equipped` с instance, slot и operation id   |
| Покупка                 | `recordBuy` после завершённой покупки  | событие в той же hero operation/UoW               |
| AREA action             | прямой вызов quest service             | generic interaction command + wait token          |
| Fight finish            | terminal observer после settlement     | `fight.finished` с fight/encounter id и receipts  |
| Fight loot              | quest query `needed()` во время payout | typed loot-interest projection, не mutation hook  |
| Craft/profession        | прямой effect или отсутствующий hook   | typed craft/profession events и effect ports      |
| Party                   | только lookup `partyIdOf`              | snapshot eligible participants + per-hero credit  |
| World/map               | статический catalog                    | conditional personal projection поверх world      |
| Journal/tracker         | `questBookSnapshot`                    | отдельный `QuestReadModel` + legacy adapter       |

Текущие hooks неполны: обычное изменение инвентаря синхронизирует owned-count,
но не фиксирует, где, почему и каким экземпляром совершено действие. Это не
позволяет надёжно выразить «использовать выданный предмет именно здесь»,
transformation provenance или одноразовый interaction attempt.

## Транзакционные наблюдения

Общая `UnitOfWork` уже поддерживает вложенные вызовы: application services
используют тот же `DatabaseSession`. Поэтому DB-effects квеста могут быть
атомарны с progress без прямого доступа к чужим таблицам.

Однако текущие пути неодинаковы:

- `USE`, `DROP`, `PUT_ON` уже оборачивают основную mutation и quest callback в
  одну UoW;
- store purchase завершает собственную операцию до `recordBuy`;
- fight settlement фиксирует ресурсы/loot, затем terminal observer отдельно
  меняет quest progress;
- chat/long-poll outbox находится в памяти процесса.

Следовательно, целевой контракт разделяет:

1. DB transition и DB-effects — одна UoW;
2. уже завершившееся внешнее событие — durable `eventId` + receipt;
3. запуск RAM/external operation — persisted intent + идемпотентный dispatcher;
4. UI push — только после commit; истину всегда можно перечитать projection.

## Locking baseline

Все hero-affecting commands сначала блокируют `heroes` row. Это становится
обязательным глобальным порядком:

1. hero rows по возрастанию id;
2. party row и membership snapshot, если нужны;
3. quest runs по id;
4. inventory items героя;
5. character/profession/reputation rows;
6. quest receipts, assets и operations.

Hero lock сериализует разные порядки внутренних repository locks для одного
героя. Party event сначала блокирует всех затронутых героев в sorted order и
только затем применяет персональные transitions. Quest engine не захватывает
второго героя неявно посреди transition.

## Что не переносим

- старые таблицы как совместимую target schema;
- `QuestDocument` v35 как долговечный authoring API;
- `script.type` switch с неограниченными payload;
- пересчёт owned inventory как замену domain events;
- один cursor на run;
- implicit order массива как graph semantics;
- in-memory fight callback как exactly-once доказательство;
- synthetic content requirements текущего validator;
- quest-specific imports в inventory/combat/world domain.

Проект не имеет production-данных. Первый implementation slice удаляет старые
quest tables миграцией, старый runtime/content и его synthetic progress без
переноса. Проверка окружения нужна только для защиты случайно выбранной не той
локальной БД, а не для сохранения старых quest rows.

## Следующий контракт

Границы компонентов определены в
[TARGET_ARCHITECTURE.md](TARGET_ARCHITECTURE.md), таблицы и ограничения — в
[PERSISTENCE_MODEL.md](PERSISTENCE_MODEL.md). Product semantics остаётся в
[DOMAIN_MODEL.md](DOMAIN_MODEL.md); технические документы не переопределяют её.
