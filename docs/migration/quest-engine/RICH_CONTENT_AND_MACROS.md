# Rich content и macros

> **Статус:** JUGGER_CLIENT + preserved wire research и целевой authoring
> contract. Macro hash, сырой `macro_type`, URL и request payload не являются
> пользовательским API редактора.

## Главный вывод

Текст квеста — не строка с необязательной картинкой, а последовательность
типизированных fragments. Один fragment может быть обычным текстом, ссылкой на
NPC/монстра/локацию, названием или иконкой предмета, суммой денег, ссылкой на
бой, изображением либо безопасным действием.

Одинаковый semantic content разрешено использовать на разных поверхностях, но
старый клиент поддерживает разные подмножества macros. Поэтому:

1. author настраивает intent и fallback, а не `[[TYPE hash]]`;
2. surface capability matrix является частью client adapter;
3. publication либо компилирует fragment точно, либо использует объявленный
   fallback, либо отклоняет definition;
4. неизвестный/неподдерживаемый macro нельзя молча превращать в успешный текст.

## Wire-модель старого клиента

Текст содержит placeholder:

```text
Найдите [[NPC 91db...]] в [[MAP b5a5...]].
```

Рядом приходит dictionary:

```json
{
  "91db...": {
    "macro_type": "NPC",
    "id": 294,
    "area_id": 501,
    "title": "Странствующий торговец",
    "macro_text": "торговца"
  },
  "b5a5...": {
    "macro_type": "MAP",
    "area_id": 501,
    "area_title": "Ущелье разлуки",
    "title": "Ущелье разлуки"
  }
}
```

Opaque key связывает placeholder и snapshot. Слово `NPC` в placeholder не
должно считаться источником истины: renderer находит payload по key и затем
смотрит его `macro_type`. Projection обязан создавать согласованную пару.

В authoring хранятся stable catalog/run references и presentation intent.
Adapter на каждый ответ создаёт уникальные wire keys, разрешает catalog data и
собирает отдельный `macros_list` нужной projection.

## Typed fragment model

Концептуальный формат:

```yaml
content:
  - type: text
    style: objective
    value: "Найдите"
  - type: entity_ref
    entity: { type: npc, id: wandering_merchant }
    label: "торговца"
    display: text
    interactions: [open_info]
    fallbackText: "Странствующего торговца"
  - type: text
    value: "в"
  - type: entity_ref
    entity: { type: location, id: separation_gorge }
    label: "Ущелье разлуки"
    display: text_and_navigator
    interactions: [navigate]
    fallbackText: "Ущелье разлуки"
  - type: entity_ref
    entity: { type: item_kind, id: overseas_potion }
    label: "заморское зелье"
    display: text
    interactions: [open_info]
  - type: entity_ref
    entity: { type: item_kind, id: bread }
    display: icon
    count: 5
    fallbackText: "Хлеб ×5"
```

Раздельно задаются:

- **entity reference** — на что ссылаемся;
- **label** — какая грамматическая форма видна в этой фразе;
- **display** — text, icon, text-and-icon, navigator или surface default;
- **interactions** — что делает клик;
- **fallback** — что увидит surface без нужного renderer;
- **count/qualifiers** — количество и допустимые presentation details.

`label` не переименовывает catalog entity. Это локальная форма «Грызлов», «в
Горном поселении», «торговца» и т. п. Редактор должен позволять вводить её либо
выбирать localization variant.

## Предметы: три разные ссылки

| Intent                       | Legacy macro    | Identity                 | Presentation                     |
| ---------------------------- | --------------- | ------------------------ | -------------------------------- |
| catalog item текстом         | `ARTIFACT`      | artikul/catalog key      | цветное кликабельное название    |
| catalog item большой иконкой | `ARTIFACT_IMG`  | artikul/catalog key      | inline image, hint, около 50 px  |
| конкретный экземпляр         | `ARTIFACT_ITEM` | named run asset/instance | durability/quality/instance info |

Immutable definition не хранит DB instance id. `item_instance_ref` разрешается
из named run asset в момент projection. Catalog item snapshot также должен
содержать достаточно данных для hint/цвета/иконки; одного числового id старому
renderer недостаточно.

`ARTIFACT_IMG` меняет высоту строки и может сломать узкую строку board/tracker.
Surface policy задаёт maximum icon count, размер и обязательный text fallback.

## Навигация и NPC

`MAP` показывает название локации и иконку навигатора. Клик устанавливает
`WorldMapModel.targetLocation` по `area_id`.

`NPC` в исследованном AS3 вызывает `showNpcInfo(npc_id)`. Хотя live payload
содержит `area_id`, сам NPC macro не устанавливает маршрут. Возможность
добраться до NPC может появляться уже в web-карточке, но это другой слой.

Поэтому authoring различает:

- `open_info` — открыть карточку NPC;
- `navigate` — поставить location target;
- `open_info_and_navigate` — composite intent, который legacy adapter может
  скомпилировать в соседние `NPC` + `MAP`, а новый UI — в один control.

Нельзя подменять catalog NPC id его world click ref или area id.

## Исследованные macro types

| Semantic kind       | Legacy `ChatMessage` | New `MacroTextParser`  | Основное действие             |
| ------------------- | -------------------- | ---------------------- | ----------------------------- |
| money               | `MONEY`              | `MONEY`                | иконка валюты + amount        |
| catalog item text   | `ARTIFACT`           | `ARTIFACT`             | item info                     |
| item instance       | `ARTIFACT_ITEM`      | `ARTIFACT_ITEM`        | instance info                 |
| catalog item icon   | `ARTIFACT_IMG`       | `ARTIFACT_IMG`         | image/hint; click различается |
| player              | `USER`               | `USER`                 | user info/context             |
| monster             | `BOT`                | `BOT`                  | bot info + hint               |
| location/navigation | `MAP`                | `MAP`                  | поставить route target        |
| NPC                 | `NPC`                | `NPC`                  | открыть NPC info              |
| combat              | `FIGHT`              | `FIGHT`                | открыть fight info            |
| book section        | `BOOK`               | `BOOK`                 | открыть раздел книги          |
| achievement         | `ACHIV`              | `ACHIV`                | открыть achievement info      |
| image               | `IMG`                | `IMG`                  | загрузить inline image        |
| URL                 | `URL`                | `URL`                  | открыть web window            |
| server action       | `ACTION`             | `ACTION`               | отправить request             |
| JavaScript call     | `JSFUNC`             | `JSFUNC`               | вызвать JS bridge             |
| module action       | `SHOW_MODULE`        | `SHOW_MODULE`          | открыть allowlisted module    |
| share/smile         | `SHARE`/`SMILE`      | `SHARE`/`SMILE`        | social/smiley UI              |
| separator           | `HR`                 | HTML/layout equivalent | horizontal rule               |
| rank                | отсутствует в switch | `RANK`                 | rank view                     |
| pet/clan/resource   | отсутствует          | отдельные types        | rich info/resource image      |

Это parser capability, а не разрешение использовать тип на любой поверхности.
В частности, два renderers имеют несовпадающие click semantics и fallback.

Macro — только inline content. Он не заменяет отдельные поля проекции текущей
цели: `quest_bot_artikuls` подсвечивает связанных монстров в world UI, а
counter bindings управляют видимостью links/hunt objects. Они описаны в
[TEXT_SURFACES_AND_QUEST_UI.md](TEXT_SURFACES_AND_QUEST_UI.md#проекция-текущей-цели-в-мир).

## Surface capability старого quest UI

| Surface                           | Renderer            | Macros | Интерактивность/ограничение                          |
| --------------------------------- | ------------------- | ------ | ---------------------------------------------------- |
| board entry `welcome_message`     | `ChatMessage`       | да     | macro controls disabled; кликабельна вся строка      |
| answer `message`                  | `ChatMessage`       | да     | macro controls disabled; кликабелен весь ответ       |
| dialog `point.message`            | `ChatMessage`       | да     | интерактивны                                         |
| `award_message`/`target_message`  | тот же point        | да     | общий dictionary point                               |
| quest `bookSummary`               | `ChatMessage`       | да     | `book\|quest_list.macros_list`                       |
| quest `rewardPreview`             | `ChatMessage`       | да     | тот же quest dictionary                              |
| current/completed target text     | `ChatMessage`       | да     | `book\|quest_targets.macros_list`                    |
| tracker target/summary            | `MacroTextParser`   | да     | другой renderer и click handler                      |
| quest title                       | `TFLabel`           | нет    | только text/HTML stripping в отдельных старых путях  |
| counter label                     | `TFLabel/PointsBar` | нет    | plain text                                           |
| waiting title                     | `TFLabel`           | нет    | picture/video являются отдельными полями             |
| host `npc_description`/`elsetext` | `ChatMessage`       | нет\*  | текущий код передаёт `null` вместо macros dictionary |

`\*` Target authoring может разрешать fragments и здесь, но legacy adapter
обязан применить text fallback либо потребовать client extension. Нельзя
отправить dictionary и считать, что старый client его использует.

## Projection dictionaries и history

Квестовая книга использует как минимум два независимых namespace:

- `book|quest_list.macros_list` для summary/reward preview;
- `book|quest_targets.macros_list` для current и completed target descriptions.

Tracker повторно использует соответствующий dictionary. Counter values идут
третьим ответом и macros не содержат.

Completed target продолжает ссылаться на inline entities, поэтому server не
должен сохранять только готовую строку с ephemeral hash. Нужны semantic content
snapshot либо устойчивые fragment refs и presentation snapshot policy. При
каждой projection adapter создаёт новый согласованный hash dictionary как для
current, так и для показываемой completed history.

## Безопасность

Несколько legacy macro являются исполняемыми:

- `ACTION` передаёт `href` в `GameResponder.SendData`;
- `JSFUNC` вызывает имя функции и arguments через JS bridge;
- `URL` открывает переданный адрес;
- `IMG` способен грузить внешний ресурс.

Обычный quest author не получает raw-доступ к этим полям. Разрешены только
typed actions из registry, например `open_item_info`, `navigate_area`,
`open_book_section`, `open_fight_info`. Компилятор сам строит payload.
Произвольный request/JS function/external URL требует отдельного privileged
extension type, code review и allowlist.

Macro type из placeholder не является security boundary. Сервер валидирует
semantic fragment до compilation, а клиент никогда не решает eligibility или
quest effect по macro click.

## Поведение ошибок

Legacy `MacrosObject` при неизвестном type или отсутствующем payload способен
нарисовать красный прямоугольник; parser также имеет несовпадающие fallbacks.
Это нельзя принимать за нормальную деградацию.

Publication validation проверяет:

- placeholder и dictionary взаимно однозначны;
- type поддержан выбранной surface;
- catalog/run reference разрешается;
- обязательные snapshot fields присутствуют;
- label/fallback локализованы;
- icon укладывается в layout budget;
- interaction разрешена allowlist;
- completed target можно перепроецировать без утраченного instance;
- один dictionary не содержит конфликтующих keys.

Runtime projection при невозможности разрешить обязательный fragment возвращает
наблюдаемую content/projection error, а не пустой macro и не частично
кликабельный текст. Только явно authored fallback может деградировать в text.

## Требования к редактору

Редактор показывает fragments как controls, а не как hash/HTML:

- выбор entity из catalog/run slots;
- text/icon/instance/navigation display mode;
- отдельный label для склонения;
- count и fallback text;
- список доступных interactions;
- предупреждение о surface capability;
- preview минимум для dialog, board row, book page, completed target и tracker;
- размер большой иконки и line wrapping;
- diff semantic references отдельно от wording.

Raw legacy import разрешён только migration tool: importer разбирает token +
dictionary, превращает известные types в fragments и оставляет quarantined
diagnostic для неизвестных/исполняемых macros.

## Что ещё проверить в CEF

1. Ведёт ли web-карточка, открытая `NPC`, к location navigation и при каких
   данных.
2. Точная кликабельность `ARTIFACT_IMG` в книге и tracker: новый handler явно
   ничего не делает на link click, но вложенный renderer может иметь собственный
   control.
3. Максимальные icon dimensions/count до поломки каждой quest surface.
4. Встречаются ли `BOOK`, `FIGHT`, `RANK`, `PET`, `CLAN` непосредственно в
   original quest book, а не только в общем chat renderer.
5. Нужна ли интерактивность macros внутри board/answer label либо оригинал
   намеренно оставляет их только визуальными.
