# Терминология текстов и quest UI старого клиента

> **Статус:** client/wire research + целевой словарь. Этот документ отделяет
> authored semantic names от исторических wire-полей. Он не требует называть
> поля будущей БД `descr`, `message` или `welcome_message`.

Слово «описание» в старом клиенте означает несколько несвязанных поверхностей.
Один общий `text` в authoring schema запрещён: автор должен понимать, где
именно строка появится, когда она выбирается и какие macros разрешены.

## Карта поверхностей

```text
Нажатие NPC/предмета
├─ Host header: имя + portrait
├─ Board intro: постоянный верхний текст host
└─ Interaction board
   └─ Board entry label × N

Выбор board entry
└─ Interaction screen
   ├─ presenter + screen body
   ├─ reward/objective summary
   ├─ answers
   └─ optional award list / waiting

Книга квестов
├─ Current quests
├─ Repeatable quests + cooldown
├─ Finished quests
└─ Selected quest details
   ├─ quest summary
   ├─ current target
   ├─ target counters/progress bars
   ├─ reward preview
   └─ completed target history

Quest tracker
├─ all active / active repeatable / favorites
└─ quest card
   ├─ quest title
   ├─ current target text (fallback: quest summary)
   └─ counter rows value/limit
```

## Канонический словарь

| Semantic name             | Что видит игрок                      | Старое wire/client поле               |
| ------------------------- | ------------------------------------ | ------------------------------------- |
| `host.title`              | имя над portrait                     | `npc.title`                           |
| `host.portrait`           | изображение слева                    | `npc.picture`                         |
| `host.boardIntro`         | текст над списком при наличии строк  | `npc.npc_description`                 |
| `host.emptyBoardText`     | текст вместо intro, если строк нет   | `npc.elsetext`                        |
| `boardEntry.label`        | текст одной строки board             | `quests[].welcome_message`            |
| `quest.title`             | стабильное название квеста           | `quest.title` / `book.quests[].title` |
| `screen.body`             | реплика текущего presenter/narration | `point.message`                       |
| `screen.rewardSummary`    | «Награда: …» внутри dialog screen    | `point.award_message`                 |
| `screen.objectiveSummary` | «Цель: …» внутри dialog screen       | `point.target_message`                |
| `answer.label`            | кликабельный ответ под репликой      | `answer_list[].message`               |
| `quest.bookSummary`       | вводное описание справа в книге      | `book.quests[].description`           |
| `quest.rewardPreview`     | блок ожидаемой награды в книге       | `award_description`                   |
| `target.description`      | текущая/завершённая цель             | `target_list[].description`           |
| `counter.label`           | подпись прогресса                    | `target.counters[].title`             |
| `counter.limit`           | максимум шкалы                       | `target.counters[].limit`             |
| `counter.value`           | текущее значение                     | `counter_list[].value`                |

В UI могут встречаться одинаковые строки, но это не делает поля синонимами.
Например, `boardEntry.label`, `screen.body`, `quest.bookSummary` и
`target.description` имеют разные lifecycle, условия выбора и client surface.
Все эти authored значения могут собираться из typed fragments, однако точная
поддержка click/icon/navigation зависит от renderer поверхности. Каноническая
матрица находится в [RICH_CONTENT_AND_MACROS.md](RICH_CONTENT_AND_MACROS.md).

## Термины прогресса: stage, objective, requirement, target

- **Stage** — один текущий player-facing шаг run. У активного квеста ровно
  один stable stage; будущие stages существуют только в definition.
- **Objective stage** — stage, который ждёт игровых действий. Его completion
  может состоять из нескольких requirements.
- **Requirement/member** — одно проверяемое действие или условие внутри цели:
  поговорить с A, поговорить с B, убить 5 существ, иметь предмет. Несколько
  requirements могут прогрессировать в любом порядке, не становясь разными
  целями.
- **Journal target** — wire/UI snapshot текущего или завершённого stage:
  `target_list[]`. Это то, что клиент называет «целью».
- **Counter** — видимая числовая/булева проекция одного requirement внутри
  target. Не каждый requirement обязан иметь видимый counter.

Gate, выбор маршрута или сдача квеста тоже могут быть stable stage, но без
counters: например target «Вернитесь к капитану». Технический переход, который
не должен быть виден игроку, не становится stage/target и схлопывается в той же
транзакции. Таким образом, «одна активная цель» не мешает сложному внутреннему
графу; она запрещает одновременно показывать или считать несколько будущих
player-facing steps одного run.

## Host board intro, он же welcome text NPC

Текст «Рот отсеченной головы застыл в немой агонии.» на приложенном скриншоте
является `host.boardIntro`. Он показывается после первого нажатия на host,
рядом с его именем/portrait и над списком interactions. Это не:

- название NPC;
- label конкретной строки;
- первая реплика открытого диалога;
- описание квеста в книге.

В старом клиенте `NPCDialogView.setNpcText()` выбирает:

```text
если открыт dialog point       → point.message (+ award/target summary)
иначе если board не пуст       → npc.npc_description
иначе                          → npc.elsetext
```

Целевая модель делает intro условным:

```yaml
hostPresentation:
  host: item_kind:dead_head
  variants:
    - key: witcher_revered
      priority: 300
      when: { reputation_at_least: { track: witcher, value: 3000 } }
      boardIntro:
        - { type: text, value: "Мёртвая голова узнаёт прославленного охотника." }
    - key: after_ritual
      priority: 200
      when: { quest_history: { quest: dead_head_ritual, state: completed } }
      boardIntro:
        - { type: text, value: "После ритуала голова выглядит непривычно спокойно." }
    - key: default
      priority: 0
      when: always
      boardIntro:
        - { type: text, value: "Рот отсеченной головы застыл в немой агонии." }
      emptyBoardText:
        - { type: text, value: "Голова не подаёт признаков жизни." }
```

Resolver выбирает ровно один variant из того же snapshot, что board entries.
Одинаковый priority пересекающихся conditions запрещён. `boardIntro` и список
не должны описывать разные состояния из-за двух независимых чтений.

Если dialog screen переопределил presenter, его `screen.body` временно заменяет
board intro. Возврат `jump:npc` заново разрешает host variant и board.

## Board entry label

`welcome_message` — исторически не welcome всего NPC, а текст конкретной строки
в списке. Например «Первое задание Скорпиона» или «Грызлы убиты, овцы целы!».
Он может меняться при offer/active/ready/branch state, даже если `quest.title`
остаётся прежним.

Недоступные entries сервер не присылает. Поэтому `boardEntry.label` выбирается
только после eligibility; отдельного текста скрытой строки клиент не увидит.
Прямой запрос её `point_id/key` всё равно авторизуется повторно.

## Dialog screen text

Один `npc|answer` screen состоит из:

```text
presenter
point.message
[horizontal separator]
[«Награда: » + point.award_message]
[«Цель: » + point.target_message]
answer_list[]
award_list?
```

Клиент сам добавляет локализованные подписи «Награда» и «Цель». Поэтому authored
`rewardSummary/objectiveSummary` не должны повторять эти заголовки. Если есть
`target_message`, клиент также показывает checkbox начала отслеживания; после
accept ответ может вернуть `quest_started`.

`screen.body` и `answer.label` используют общий macros payload данного экрана,
но поддерживаемые macro types для каждой поверхности всё равно валидируются.

## Книга квестов: что в ней действительно находится

Книга не является одним текстом и не является каталогом всех определений. Её
левая страница содержит три раскрываемые категории:

1. **Текущие квесты** — rows со `status: started`.
2. **Повторяемые квесты** — завершённые multitime rows, доступные, ожидающие
   cooldown или дополнительно недоступные.
3. **Завершённые квесты** — history, загружаемая отдельным
   `BookQuestlog("finished")` при открытии категории.

Повторяемая строка показывает `quest.title` и client-generated state text:

- «доступен»;
- «недоступен» + optional hint `not_available_reason`;
- оставшееся время, вычисленное клиентом как `ftime + cooldown - now`.

Строка cooldown не имеет отдельного authored countdown text. Автор задаёт
cooldown policy; клиент форматирует дни/часы/минуты/секунды.

Wire `book|quest_list` может содержать shadow/unavailable rows для внутренних
связей клиента, хотя interaction board такие предложения не показывает. Это не
опровержение server-side filtering board/answers: поверхности имеют разные
projection contracts.

## Правая страница выбранного квеста

Порядок блоков в `QuestRightPage`:

1. `quest.bookSummary`;
2. заголовок клиента «Текущая цель» и один unfinished target;
3. заголовок клиента «Награды» и `quest.rewardPreview`;
4. заголовок клиента «Выполненные цели» и все finished targets.

Каждый target содержит собственный `target.description`. Active target рисуется
красным. Finished target рисуется серым с галочкой. Completed history — это не
dialog history: клиент хранит и показывает закрытые `target_list` rows данного
активного квеста. После terminal completion operational targets обычно исчезают,
а finished quest history показывает сохранённый quest summary, не обязательно
полный журнал всех целей. Нужен product decision, сохраняем ли расширенную
историю на сервере для будущего UI, даже если старый клиент её не показывает.

`target.counters[]` определяет шкалы: label и limit. Отдельный
`book|quest_counters.counter_list[]` поставляет value. На правой странице это
настоящие progress bars; у finished target live wire обычно уже отдаёт пустой
список counters.

## Инвариант: только одна текущая цель квеста

Это не только ограничение renderer. Preserved wire и старый сервер подтверждают
семантику оригинала: у активного квеста есть finished history и ровно один
current target. Будущие targets сервер не присылает. Дополнительно клиент
небезопасен даже к ошибочному payload с несколькими unfinished rows:

- `QuestRightPage` после сортировки сохраняет только последний встреченный
  unfinished target в слот «Текущая цель»;
- tracker `getQuestTarget()` берёт первый unfinished target;
- эти две поверхности могут выбрать разные записи.

Baseline для «поговорить с A, B, C в любом порядке»:

```text
один active target
  description: «Поговорите с тремя дозорными»
  counters:
    - «Дозорный северных ворот» 0/1
    - «Дозорный западных ворот» 1/1
    - «Дозорный южных ворот» 0/1
```

Это один objective/stage с тремя independently progressing requirements и
одним completion expression `all`, а не три objective nodes, склеенные только
для клиента. Его `journal.description` и visible counters задаются явно.
Следующий objective активируется и materialize только после закрытия текущего;
тогда старый target получает `FINISHED`, а новый становится единственным
unfinished target. Поддержка нескольких current targets возможна лишь как
будущее расширение движка и клиента, но не входит в baseline.

## Quest tracker

Tracker использует те же `QuestVO`, targets и counters, но отображает их иначе:

- tabs: все активные, активные `MULTITIME`, избранные;
- card title: `[level] quest.title` и semantic quest icon;
- expanded body: текущий `target.description`, а если target отсутствует —
  `quest.bookSummary`;
- counters: `counter.label` и текст `value/limit`, не книжный progress bar;
- кнопка «Подробнее» выбирает квест и открывает его правую страницу в книге;
- состояние expanded/collapsed хранится локально на quest id.

Следовательно, `trackerText` как отдельное обязательное поле обычно не нужно:
tracker переиспользует target description. Но definition может позднее получить
явный `trackerOverride`, если будет найден оригинальный пример с другим текстом;
до evidence такое поле не добавляется.

## Избранное, отслеживание и выбранная строка — разные состояния

| Понятие           | Cardinality | Где хранит старый клиент                        | Поведение                             |
| ----------------- | ----------: | ----------------------------------------------- | ------------------------------------- |
| `favorite/chosen` |       много | local SharedObject `questChosen{id}`            | включает квест во вкладку «Избранные» |
| `trackedQuestId`  |        0..1 | server personal detail `watch_quest_id` + model | поднимает card вверх и раскрывает её  |
| `selectedQuestId` |        0..1 | runtime UI model                                | определяет правую страницу книги      |
| `trackerExpanded` |   по квесту | local SharedObject                              | только раскрывает/сворачивает card    |

Старый клиент не отправляет обычный `chosen` на quest server: checkbox меняет
локальный SharedObject. `trackedQuestId` сохраняется через
`userSavePersonalDetails`; при init сервер возвращает `watch_quest_id`.

При принятии квеста dialog `target_message` может показать checkbox «следить за
квестом». Клиент затем локально назначает `trackedQuestID` из `quest_started`.
Нужно отдельно проверить, когда этот путь синхронизирует personal details:
прочитанный AS3-фрагмент сам вызов сохранения не делает.

Целевой baseline сохраняет original behavior:

- favorites остаются client preference и не входят в `HeroQuestRun`;
- один tracked quest является user preference, а не прогрессом квеста;
- удаление/завершение квеста очищает или безопасно игнорирует stale tracking;
- authoring content не может принудительно сделать себя favorite.

## Проекция текущей цели в мир

Книга — не единственный consumer текущей цели. Старый клиент использует
`quest_bot_artikuls` unfinished target как список связанных monster catalog ids.
Но отображает подсказку не для всех активных квестов, а только для:

- всех локально избранных (`chosen`) квестов;
- одного `trackedQuestId`.

Для совпавшего monster artikul клиент:

- меняет иконку monster link;
- показывает quest marker над монстром в hunt view;
- добавляет hint со списком названий связанных квестов.

Следовательно, `relatedMonsterCatalogIds` — отдельное поле journal/world
projection. Его можно вывести из kill requirements, но compiler обязан
позволить явное presentation override: BOT macro в тексте сам по себе не должен
делать монстра целью, а требование не обязано подсвечивать каждый допустимый
variant.

Есть и обратная связь от progress к миру. Обычный `LocationLinkData` может
содержать `quest_counter_id/min/max`; hunt mapping object — `qc_id/min/max`.
Клиент скрывает link/object, пока счётчик отсутствует или не попадает в
диапазон. Отдельный `q_object` рисует над mapping object quest icon. Это
позволяет одной текущей цели последовательно открывать точки, NPC и действия,
не создавая будущие targets.

Legacy client ищет counter только по одному числовому id, без quest id. Поэтому
wire counter ids обязаны быть уникальны среди одновременно опубликованных
счётчиков и всех world bindings, видимых герою. Внутри authoring допускаются
локальные semantic keys, но compiler назначает collision-free wire ids и
публикует те же ids в book и area projections.

Visibility не является защитой. Сервер не присылает недоступный link/object,
когда возможно, но direct request всё равно проверяет active run, current stage,
counter range и location. Обновление progress помечает dirty как минимум book,
tracker и затронутые area/hunt projections.

## Маркеры доступных квестов у NPC

Это третий, отдельный механизм. Старый клиент загружает static quest catalog и
сам вычисляет, есть ли у NPC доступный новый квест. Результат:

- заменяет обычную NPC link icon на мигающий `available_quest_icon`;
- делает NPC marker на региональной карте жёлтым и мигающим;
- добавляет названия доступных квестов в feature list карты.

В static record дублируются quest/NPC id, title, level range, faction и наборы
restrictions. Client evaluator знает money, artifacts, clan, faction, area,
quest status, quest counter, profession, mission, rank, achievement, gender и
server id. Это объясняет, почему верный board payload сам по себе недостаточен
для правильного маркера на карте.

В целевой системе автор не поддерживает второй список условий вручную.
Publication compiler строит `QuestAvailabilityProjection` из тех же typed
conditions, что использует authoritative board resolver, и отклоняет condition,
которую legacy marker adapter не способен выразить без безопасного fallback.
Board может дополнительно присылаться уже отфильтрованным, но server-side
authorization при открытии и принятии обязательна.

Static client evaluation по природе может устареть между push/poll. Поэтому
ложноположительный marker допустим только как краткая presentation race: при
клике сервер возвращает актуальный board без недоступного entry. Долговременное
расхождение marker и board является projection bug и наблюдается метрикой.

Синхронизация favorites между устройствами может быть отдельным улучшением, но
не должна менять quest engine schema.

## Authored text contract

Каждое текстовое поле объявляет:

```text
semantic key
surface(s)
localization key или inline draft
typed fragments/macros
style intent
conditions/variant priority, если поле условное
snapshot policy для history
length/client-layout limits
```

Переиспользование текста делается ссылкой на localization/content fragment, а
не одним полем, которое случайно отображается в пяти местах. Редактор должен
предпросматривать минимум board, dialog screen, book right page и tracker card
отдельно.

## Закрытые исследования и оставшиеся продуктовые решения

- В доступных live dumps условный `npc_description` не пойман: у одного NPC
  менялся состав board, но intro оставался тем же. Условные variants остаются
  подтверждённым владельцем продукта требованием; синхронная смена portrait и
  title разрешается той же host-presentation variant, но не обязательна.
- Клиент передаёт macros в `SetText` только для открытого point. Для
  `npc_description` и `elsetext` передаётся `null`; значит, legacy adapter
  использует authored text fallback либо требует client extension. Это не
  ограничивает общую typed content model. Rich text/inline HTML работает.
- Finished quest payload содержит summary/status/timestamps, но не targets.
  Completed target history показывается, пока run активен; расширенная
  post-completion история может храниться сервером для будущего UI, но старому
  клиенту не отправляется.
- Preserved wire и legacy `buildQuestTargets` подтверждают: finished targets +
  первый incomplete, без будущих targets. Несколько simultaneous incomplete
  targets считаются invalid projection.
- Checkbox принятия присваивает `trackedQuestID` локально, но в найденном пути
  не вызывает `userSavePersonalDetails`; кнопка книги вызывает. В новом runtime
  оба пути следует сохранять одинаково — это исправление клиентской
  непоследовательности, а не quest-state semantics.
- Favorites оригинала локальны и множественны. Server-synced favorites —
  отдельное необязательное продуктовое расширение.
