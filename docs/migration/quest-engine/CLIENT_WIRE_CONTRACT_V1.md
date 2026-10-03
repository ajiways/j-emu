# Quest engine: Jugger client/wire contract v1

> **Статус:** evidence-backed contract для Flash adapter. Документ фиксирует
> только то, что подтверждено сохранённым `reg_6lvl` wire и декомпилированным
> AS3-клиентом. Он не превращает особенности клиента в доменную модель.

## Источники и границы уверенности

Основной динамический источник — `_research/reg_6lvl`: прохождение одним героем
регистрации и уровней 1–6, 19 принятых квестов и 46 снимков книги. Request body
в исходном HAR местами повреждён оболочкой form-urlencoded, поэтому числовые
request ids считаются достоверными только там, где они восстанавливаются из
предыдущего server response и клиентского `GameResponder`. Response AMF и их
порядок сохранены полностью.

Основной статический источник — AS3-классы:

- `modules/npc/NPCDialogView`, `QuestBlockItem`, `WaitingPanel`, `AwardPanel`;
- `modules/npc/data/QuestData`, `PointData`, `AnswerData`, `NpcInfoData`;
- `model/bookmodel/quests/QuestsModel` и book/tracker renderers;
- `constants/quest/QuestCodes`, `QuestFlags`, `QuestTargetFlags`.

Правила ниже помечаются смыслом источника:

- **wire** — реально встречалось в `reg_6lvl`;
- **client** — клиент явно читает или исполняет поле;
- **target** — безопасное правило нового adapter/runtime.

## OA-карта

| OA                      | Назначение                       | Подтверждённая форма                                                   |
| ----------------------- | -------------------------------- | ---------------------------------------------------------------------- |
| `npc\|quests`           | открыть interaction board host   | request `ref`; response `quests`, `action_list`, `macros_list`, `href` |
| `npc\|info`             | presenter/host header            | `npc.id/title/picture/npc_description/elsetext`                        |
| `npc\|answer`           | открыть point или выбрать answer | `point_id`, `answer_id`, `key`, optional `award_id`                    |
| `book\|quest_list`      | строки книги и history ids       | `quests` map, `finished_quests_id`, `macros_list`                      |
| `book\|quest_targets`   | history/current targets          | `target_list`, `macros_list`                                           |
| `book\|quest_counters`  | текущие значения                 | `counter_list`                                                         |
| `common\|action`        | AREA/item action                 | может вернуть `common\|waiting`                                        |
| `common\|action_finish` | завершить server wait            | completion response + optional book/fight/state piggybacks             |

Сервер не должен полагаться на фильтрацию клиента. Board отдаёт только видимые
entries, но любой прямой `npc|answer`, `common|action` и `action_finish`
повторно авторизуется по hero, host, текущему stage, key/id и requirements.

## Interaction board и host intro

`npc|quests` подтверждён в форме:

```text
{
  status,
  ref,
  quests: [QuestBoardRow, ...],
  action_list: [HostActionRow, ...],
  macros_list,
  href
}
```

`npc|info.npc` приходит рядом и содержит presenter. Клиент выбирает верхний
текст так:

1. если открыт point — `point.message`;
2. иначе если board непуст — `npc_description`;
3. иначе — `elsetext`.

`welcome_message` принадлежит отдельной строке board, а не host intro.
`action_list` и `quests` объединяются одним экраном; action принудительно
получает client action type `COME_IN` и кнопку «Войти», quest row — «Подробнее».
При пустом объединённом списке нижняя часть board скрывается.

Клиент сортирует host actions перед quest rows. Quest rows затем сортируются:
main, repeat/zero-flag, остальные; внутри группы — больший `level_min` раньше.
Это presentation parity, не порядок authoring graph.

`level_min/level_max` сами по себе не являются client authorization. Renderer
использует `level_min` для цвета и подписи строки, но не запрещает клик. Более
того, в `reg_6lvl` герой уровня 5 открыл и принял quest 36 «Дело Бешеного быка»
с `level_min:7`. Поэтому importer сохраняет эти поля как `levelHint`; реальный
level gate существует только при явном availability condition.

### Точные icon flags этого клиента

Point flags, прочитанные `QuestBlockItem`:

|  Bit | Имя в клиенте  | Семантика иконки            |
| ---: | -------------- | --------------------------- |
|  `8` | `PF_START`     | offer/start                 |
| `16` | `PF_FINISH`    | active/turn-in point family |
| `32` | `PF_MULTITIME` | dialog/repeat family        |
| `64` | `PF_REMIND`    | read-only/reminder family   |

`point_flags == 0` выбирает ту же базовую строку, что и `PF_FINISH`. Проверки
идут последовательно, поэтому при нескольких bits более поздний `REMIND`
перекрывает выбранную строку, а `MULTITIME` перекрывает `START/FINISH`.

Quest flags, которые реально влияют на этот renderer:

|    Bit | Имя         | Колонка icon family |
| -----: | ----------- | ------------------- |
|    `1` | `MULTITIME` | repeat              |
|   `32` | `MAIN`      | main                |
|   `64` | `DEFAULT`   | default             |
| `4096` | `MOVE`      | movement/service    |

`action.code != null` полностью заменяет вычисление на `qst_store`. Категории
`GROUP/INSTANCE/CLAN` существуют в `QuestFlags`, но их поведение нельзя выводить
из этой функции. Adapter получает semantic presentation kind и централизованно
выводит legacy flags; автор не набирает bit mask вручную.

## Диалоговый экран

Открытие board row отправляет:

```text
{ object:"npc", action:"answer", point_id, answer_id:0, key }
```

Выбор answer отправляет текущий `point.id`, `answer.id`, `answer.key` и, если
обязателен reward choice, выбранный `award_id`.

Обычный response:

```text
{
  status: 100,
  point: { id, message, award_message, target_message },
  quest: { title, level_min, level_max },
  answer_list: [{ id, key, message, ord, ... }],
  npc: [] | { id, title, picture, npc_description, elsetext },
  macros_list,
  expire,
  quest_started?,
  award_list?
}
```

Это единый экран: `point.message`, затем optional разделитель, затем подписанные
`award_message` и `target_message`; ниже располагаются варианты ответа.
`answer_list` сортируется по `ord`. Поле `npc` в ответе меняет presenter,
картинку и имя внутри той же сцены. Пустой объект без `id` возвращает исходного
presenter через fallback `NpcInfoData.firstData`.

### `jump` имеет терминальный приоритет

`NPCDialogView.Answer` сначала обрабатывает optional `quest_started`, затем при
наличии `jump` вызывает navigation и немедленно выходит:

- `jump:"area"` закрывает экран и возвращает последний world mode;
- `jump:"npc"` повторно открывает board по сохранённому `href`.

Поля `point`, `answer_list`, `award_list` и presenter в том же response после
`jump` клиент уже не отрисует. Adapter не должен совмещать terminal jump с
данными, которые обязан увидеть игрок. `quest_started` является исключением:
он читается до jump и может локально назначить tracked quest.

В wire принятие встречается и как jump-only, и как `quest_started` вместе с
новым point. Отдельного `quest_finished` нет: сдача определяется по новой книге
(`finished_quests_id`, исчезновение active row) и state/reward piggybacks.

### Presence-sensitive поля

- `to_fight` становится `true`, если поле **присутствует и не null**. Значение
  `0` тоже даст fight icon; false необходимо кодировать отсутствием поля/null.
- `probability` показывает check icon, процент и цвет, если значение не null;
  диапазоны клиента: `<=30`, `31..70`, `>70`.
- `award_id` отправляется только если ненулевой.
- `quest_started` wire приходит строкой, хотя domain id остаётся typed id.

Такие правила покрываются raw-AMF golden tests: generic serializer не должен
добавлять false/default fields автоматически.

## Два разных ожидания

### Answer pre-submit delay

`answer_list` может содержать:

```text
waiting_time, waiting_title, waiting_picture, waiting_video
```

Для `waiting_time > 0` клиент **ещё не отправляет** `npc|answer`. Он строит
request локально, показывает `WaitingPanel` и вызывает `SendData` только после
таймера. Кнопка «Отмена» просто закрывает панель; server command отсутствует.
Значит, никакой server checkpoint, consume, RNG или branch commit до конца
такого таймера не существует. Закрытие окна также не меняет server state.

Для video клиент показывает skip; skip/окончание видео отправляет тот же заранее
собранный request. `waiting_title` — plain label, `waiting_picture` — фон из
NPC waiting assets, `waiting_video` — имя video asset.

Target model называет это `answerDelayPresentation`, а не `QuestWait`. Оно
допустимо только как необязательная client presentation перед обычной
идемпотентной answer command. Сервер всё равно обязан корректно обработать
немедленный прямой request без ожидания.

### Server-authoritative prolonged action

AREA interaction из `reg_6lvl` подтверждает другой lifecycle:

```text
common|action(AREA)
  -> common|waiting { title, start, finish, action_src }
  -> common|action_finish
  -> counters/targets, state and/or fight|conf
```

Здесь start уже принят сервером. Это persisted operation с deadline,
idempotency, reconnect/cancel policy и проверкой `notBefore`. Первый finish
может начать засаду вместо progress; только последующий успешный completion
увеличивает нужный counter. Эти два вида ожидания нельзя реализовывать одним
state machine или одним authoring field.

## Выбор награды

Response point может содержать `award_list`. Клиент:

1. строит item renderers из catalog-shaped rows;
2. не выбирает вариант по умолчанию;
3. сохраняет `rawData.award_id` после клика;
4. блокирует следующий answer с сообщением «награда не выбрана»;
5. добавляет `award_id` в обычный `npc|answer`.

Wire квеста 14 подтверждает эту последовательность. Сервер проверяет selection
против актуального stage и eligibility, фиксирует один choice атомарно и на
retry возвращает тот же результат. Порядок `award_list` — presentation; stable
identity — `award_id` текущей release.

## Book trio

### Quest list

Live форма:

```text
book|quest_list: {
  status: 100,
  filter_type?: "started",
  quests: { "0": QuestRow, "1": QuestRow, ... },
  finished_quests_id: { "151":"151", ... } | [],
  macros_list
}
```

Active row имеет `status:"started"`. Тот же map может содержать shadow rows без
status и unavailable rows с `not_available/not_available_reason`; клиент не
должен считать их активными. В `reg_6lvl` одновременно было до шести active
quests плюс shadow rows.

### Targets и counters

```text
book|quest_targets: {
  target_list: [{
    id, quest_id, description,
    counters: [{ counter_id, limit, title }],
    quest_bot_artikuls,
    flags, stime, ftime
  }],
  macros_list
}

book|quest_counters: {
  counter_list: [{ id, quest_id, value }]
}
```

`target.counters` описывает шкалу; `quest_counters` несёт значение. Их нельзя
смешивать одной DTO. `counter_id` должен быть collision-free глобально в
клиентской projection, потому что часть AS3 lookup ищет только по counter id.

Не каждый `quest_counters` row обязан иметь matching nested counter текущей
цели. При принятии quest 36 wire сразу отдаёт `{id:23, quest_id:36, value:1}`,
хотя его current target имеет `counters:[]`. `QuestsModel` сохраняет такой row
как отдельный counter; world links/hunt objects умеют gate-иться по numeric
counter id. Связь именно counter 23 с конкретным link в сохранённых данных не
найдена, поэтому назначение — inference, но необходимость поддерживать hidden
projection counters подтверждена клиентом. Runtime хранит их как именованные
run/world facts, adapter выдаёт назначенный wire id; UI progress counters от
этого остаются отдельными.

Target `flags:0` — current, `flags:1` — finished. Снимки квестов 151 и 13
подтверждают последовательную materialization: прошлые цели + ровно одна
текущая, без будущих целей. Завершённый target обычно приходит уже без nested
counters. Несколько действий одной цели выражаются несколькими counters или
составным requirement, а не несколькими current target rows.

Киллы, покупка и equip могут изменить server progress без немедленного book
piggyback. Projection обязана быть правильной при следующем book/NPC/init;
немедленный push в j-emu допустим как UX extension, но не является условием
корректности domain transition.

## Зафиксированный baseline `reg_6lvl`

Набор должен стать regression corpus, а не только исследовательской заметкой:

- board → многоэкранный accept → `quest_started` → book trio;
- цепочка 151 → 818 → 13;
- принятие quest 36 на level 5 при presentation `level_min:7`;
- последовательные targets 151 и двухфазный kill quest 13;
- до шести параллельных active quests;
- quest 14 с `award_list/award_id`;
- ORATORY answers с probabilities `8/20/25/50`;
- dialog answer с `to_fight`;
- AREA bridge/lake/delivery waits, включая ambush;
- accept нового quest и finish предыдущего одним answer;
- instance presentation flag `256` на quest 33;
- shadow/unavailable rows и `not_available_reason`;
- hidden/orphan counter row, не входящий в current target progress bars;
- HTML + `MAP/BOT/NPC/ARTIFACT/MONEY` macros.

При реализации из corpus выделяются минимальные anonymized golden fixtures.
Production tests не читают 12–50 MB research JSON целиком.

## Что всё ещё не доказано

- server behavior при закрытии уже отправленного answer во время сетевого
  запроса; target runtime решает это идемпотентностью command;
- cancel wire для `common|waiting` и refund policies;
- полный HTML/macro allowlist по всем версиям клиента;
- редкие комбинации point bits и clan/move icons в реальном wire;
- точная формула ORATORY и возможность повторной попытки;
- cooldown UI для часовых/дневных/недельных повторов;
- party credit и dungeon loot semantics;
- authentic branch flows Грого/Ведьмака/Быка после границы имеющихся данных.

Эти пункты не блокируют core graph/runtime. Они остаются capability- или
content-specific вопросами и не получают скрытых defaults в wire adapter.
