# Quest engine: диалоги, проверки и presentation

> Точный session/command/transaction contract находится в
> [DIALOG_RUNTIME_SPEC_V1.md](DIALOG_RUNTIME_SPEC_V1.md).

Этот документ задаёт серверную семантику диалогов. Он не описывает будущий
визуальный редактор, но фиксирует модель, которую редактор обязан уметь
показывать и безопасно изменять.

## Почему диалог — не массив реплик

В оригинальном контенте диалог одновременно может:

- предварять принятие квеста несколькими экранами;
- продолжаться после фактического `quest_started`;
- показывать NPC другой текст для конкретной активной или выполненной цели;
- предлагать несколько ответов и расходиться по полноценным веткам;
- выполнять проверку красноречия или вероятности;
- запускать ожидание, бой, перемещение и типизированные effects;
- менять текст, цветовое оформление, marker/icon и допустимые ответы;
- сохранять необратимое решение, влияющее на последующие квесты и NPC.

Поэтому целевая модель разделяет:

1. **DialogDefinition** — неизменяемый граф сцен опубликованной revision;
2. **DialogEntry** — правило выбора входа для конкретного NPC и состояния;
3. **DialogSession** — сохранённый экземпляр прохождения сцены;
4. **DialogueDecision** — одна уже совершённая проверка или развилка;
5. **DialogProjection** — точный ответ для текущего клиента.

Scene не обязана принадлежать квесту. Тем же контрактом пользуются обычный
разговор, item-hosted episode, activity и service; owner scope определяет, где
живут checkpoint, decisions и effects.

Один `dialog_cursor` на весь квест запрещён: отдельные разговоры с NPC A, B и
C внутри одной составной цели, optional scenes и несколько entry points иначе
перетирают друг друга.

## Один клиентский экран

Реплика NPC и все доступные варианты ответа являются одним неделимым
`InteractionScreenProjection`, а не двумя последовательными UI-экранами:

```text
InteractionScreenProjection
├── point: title/message/target/award presentation
├── presenter: actor/name/portrait
├── answer_list: все доступные сейчас ответы
├── award_list?: кликабельные варианты награды
├── macros/media/answerDelay?: дополнительные presentation blocks
└── session/revision/screen/command tokens
```

Внутренний interpreter может разделять вычисление текста, choices, checks и
effects, но projection всегда материализует renderable screen целиком. Не
существует отдельного клиентского состояния «показали реплику, теперь отдельным
запросом покажем ответы». Нажатие ответа переводит на следующий целый экран
либо возвращает terminal command: wait, fight, service, board, store или map.

`point.message`, host `npc_description`, board `welcome_message`, book
`description` и target `description` — разные semantic fields. Их полный
словарь и правила переиспользования находятся в
[TEXT_SURFACES_AND_QUEST_UI.md](TEXT_SURFACES_AND_QUEST_UI.md).

## DialogDefinition

Минимальный реестр узлов:

| Узел      | Назначение                                                     |
| --------- | -------------------------------------------------------------- |
| `screen`  | presenter + реплика/narration + доступные ответы одним экраном |
| `check`   | skill/probability check с явными outcome edges                 |
| `accept`  | атомарное принятие квеста или текущего objective stage         |
| `effect`  | вызов только зарегистрированного typed effect                  |
| `wait`    | server-authoritative ожидание с persisted deadline/outcome     |
| `fight`   | запрос на создание quest-bound encounter                       |
| `turn_in` | проверка сдачи и переход к reward                              |
| `reward`  | выбор/выдача reward package                                    |
| `jump`    | закрытие/перемещение presentation                              |
| `end`     | завершение сцены                                               |

`screen.content` может группировать несколько последовательно оформленных
фрагментов. `screen.answers` находится под ответом NPC в том же payload. Только
нажатие ответа или server command является commit boundary. Сам факт отрисовки
текста не должен незаметно выдавать предмет или бросать RNG.

Каждое ребро имеет стабильный key, conditions и destination. Порядок массива не
является идентичностью и не может менять сохранённые решения после публикации.

## DialogEntry и state-specific тексты

NPC не имеет одного `welcome_active`. Он имеет упорядоченный набор entries:

```yaml
entries:
  - key: ready_with_both_parts
    actor: npc:scorpion
    when:
      all:
        - quest_run_state: active
        - objective_state: { key: find_glove, state: completed }
        - objective_state: { key: find_bracer, state: completed }
    scene: scorpion_both_parts
    priority: 300
  - key: active_missing_parts
    actor: npc:scorpion
    when: { quest_run_state: active }
    scene: scorpion_reminder
    priority: 100
```

Resolver использует один согласованный snapshot для board, marker и dialogue.
При одинаковом priority пересекающиеся conditions являются ошибкой публикации.
Fallback должен быть явным. Важные категории входов:

- offer и pre-accept continuation;
- active с точным набором открытых/готовых objectives;
- ready-to-turn-in;
- committed branch/outcome;
- completed/cooldown/history;
- optional stateless chatter.

Entry выбирается не только для NPC. `InteractionHost` может быть предметом,
AREA или объектом мира. Host и `Presenter` разделены: конкретный screen
может заменить actor, имя и portrait. AS3-клиент это поддерживает через поле
`npc`, после которого обновляет заголовок и изображение говорящего.

Так выражается реплика «цель принята, но ещё не выполнена» именно у нужного NPC,
а не как глобальный special case в handler.

## Сервер фильтрует недоступное

Недоступный квест, строка board или вариант ответа вообще не сериализуется в
ответ клиенту. Baseline не отправляет disabled entry с объяснением ограничения:
клиент видит только `visible && available` элементы текущего snapshot.

Скрытие не является авторизацией. `ChooseAnswer` повторно проверяет:

- host/actor и право взаимодействовать с ним;
- session, revision, screen и одноразовый command token;
- что `answer_key` является непосредственным ответом текущего screen;
- все текущие conditions, цену, inventory и context;
- что branch/effect всё ещё допустимы.

Подделанный id скрытого квеста/ответа, stale screen и переход сразу в далёкий
узел отклоняются без effect. Ошибка не обязана раскрывать, существует ли
скрытый вариант; диагностическая причина остаётся в structured audit log.

## DialogSession

Сессия идентифицируется как минимум:

```text
session_id
hero_id
definition_revision_id
scene_key
entry_key
run_id?                  # отсутствует до принятия
activation_token
committed_node_key
status
created_at / updated_at
```

Pre-accept session не является `HeroQuestRun`: квест ещё не принят и не должен
попасть в journal/history. Но она нужна, если до принятия есть проверки,
необратимые effects или несколько экранов, продолжение которых нельзя безопасно
перезапускать. После `accept` эта же команда связывает session с созданным run.

Для каждой scene author явно выбирает `resume_policy`:

| Policy              | Поведение при повторном открытии                                 |
| ------------------- | ---------------------------------------------------------------- |
| `resume_checkpoint` | продолжить с последнего committed node; default для quest scenes |
| `restart_on_open`   | начать с entry; допустимо только без RNG и effects               |
| `stateless`         | вообще не создавать session; только безопасный chatter           |

Validator запрещает `restart_on_open/stateless`, если достижимы check, effect,
accept, reward, fight, inventory mutation или permanent decision.

Terminal sessions можно compact-ить, но решения, влияющие на run/history/world,
не удаляются вместе с UI checkpoint.

## Что происходит, если закрыть диалог

Закрытие окна само по себе не является отменой и обычно не требует команды:
серверной истиной остаётся последний committed checkpoint.

- Игрок только открыл экран и ничего не нажал: изменений нет.
- Игрок нажал ответ: переход уже либо полностью committed, либо полностью
  отклонён; после открытия показывается новый checkpoint.
- Игрок прошёл две pre-accept реплики: `resume_checkpoint` продолжит с третьей;
  `restart_on_open` может начать заново только если эти реплики чистые.
- Игрок дошёл до проверки, но не нажал ответ: броска ещё нет.
- Игрок нажал ответ с проверкой и закрыл окно: исход уже сохранён и не
  перебрасывается.
- Состояние мира изменилось между open и click: command повторно валидирует
  answer guard по свежему snapshot. Уже committed исход не пересматривается.

Ответ клиента содержит `session_id`, `node_key`, `answer_key`, revision и
одноразовый command token. Ответ для устаревшего node не исполняется как новый.

Узел `close_dialog` может автоматически закрыть presentation и вернуть карту.
Это authored navigation outcome, а не эквивалент `cancel quest` или rollback.

## Циклы, меню и ответы «назад»

В отличие от objective graph, dialog graph может быть цикличным: обычный NPC
разрешает вернуться в меню, повторно прочитать справку или выбрать другую
услугу. Чистые screen/jump можно обходить многократно. Mutation, check,
cost, wait, fight и reward внутри цикла требуют отдельного activation token и
idempotency key; без него публикация запрещена. Закрытие окна не создаёт новый
activation и не позволяет повторить уже committed действие.

## Красноречие, вероятность и защита от reroll

`check` — не декоративное поле ответа, а отдельное доменное решение:

```yaml
- key: persuade_guard
  type: check
  check:
    kind: oratory
    probability:
      base: 35
      modifiers:
        - from_stat: oratory
    attempt:
      policy: once_per_activation
  outcomes:
    success: guard_convinced
    failure: guard_refused
```

На первой допустимой попытке runtime:

1. блокирует session/run;
2. проверяет command token и текущий node;
3. вычисляет и snapshot-ит реальную вероятность и влияющие stats;
4. получает случайное значение один раз;
5. создаёт `DialogueDecision` с outcome и выбранным edge;
6. планирует effects и новый checkpoint;
7. фиксирует всё одной транзакцией;
8. только после commit возвращает клиентский payload.

Decision key содержит `(session_id, check_key, activation_token)`. Повтор того же
запроса возвращает уже записанный outcome. Повторное открытие, reconnect, timeout
ответа или restart сервера не создают новую попытку.

Храним как минимум:

```text
decision_id, session_id, run_id?, check_key, activation_token
probability_snapshot, input_snapshot, outcome, selected_edge
command_id, decided_at
```

Сырой random sample можно хранить для аудита, если это допускает выбранный RNG
contract. Для воспроизводимости тестов runtime получает RNG как зависимость.

Повторные попытки разрешаются только автором:

- `once_per_run`;
- `once_per_activation`;
- `limited` с числом попыток;
- `cooldown`;
- `cost` с атомарным списанием ресурса;
- recovery edge, создающий новый activation token.

Неявного «закрыл окно — попробовал ещё раз» не существует. Failure — настоящее
ребро графа. Возврат к той же реплике без смены activation token показывает уже
сохранённый failure.

Вероятность, показанная клиентом, должна равняться вероятности, использованной
сервером. Если клиент умеет показать только фиксированное число, projection
сначала вычисляет его из того же snapshot, который command затем проверяет на
staleness.

## Atomic answer transition

Логическая транзакция одного ответа включает:

```text
validate session/node/revision/token
→ evaluate guards
→ resolve or reuse decision
→ reserve/consume/grant resources
→ write flags/outcomes/objective transitions
→ create encounter/wait intent when required
→ advance session checkpoint
→ append outbox messages
→ commit
```

Нельзя сначала передвинуть cursor, а потом отдельными запросами раздать предмет,
записать flag и запустить бой. И наоборот, нельзя выдать предмет, оставив старый
cursor. Внешний fight/notification transport получает данные через outbox и
идемпотентный consumer.

Старый `server` не является контрактом: там выбор edge/cursor и последующие
effects выполняются несколькими независимыми операциями. Это полезное
предупреждение, а не образец реализации.

## Одновременные и необратимые сцены

Parallel objectives могут иметь независимые sessions для разных actors. Их
checkpoint хранится по scene instance, а objective graph остаётся источником
истины для прогресса. Завершение разговора с NPC B не двигает cursor NPC A.

Для развилки вроде изгнания Грого scene записывает `HeroQuestDecision` и
`QuestOutcome`; уже затем projection меняет присутствие NPC, будущие entries и
доступные квесты. Текст диалога сам по себе не является world state.

Если внешний outcome сделал открытую сцену неактуальной, следующий command
получает `stale_dialog` и клиенту предлагается переоткрыть NPC. Runtime не
исполняет старый ответ в новом мире.

## Wait, fight и закрытие клиента

В старом wire существуют два разных механизма. Поля answer `waiting_time`,
`waiting_title`, `waiting_picture`, `waiting_video` создают локальную
pre-submit presentation: клиент ещё не отправил `npc|answer`, cancel ничего не
сообщает серверу, а завершение/skip отправляет заранее собранный request. Эта
задержка не хранит intent/state, не бросает RNG и не является commit boundary.
Прямой request без ожидания всё равно проходит обычную server authorization.

Dialog node `wait` означает только server-authoritative operation, например
подтверждённый `common|waiting → action_finish`. Он хранит intent/deadline,
переживает reconnect и не доверяет client timer как доказательству завершения.
После reconnect сервер либо возвращает оставшееся время, либо уже committed
outcome. Подробная wire-граница находится в
[CLIENT_WIRE_CONTRACT_V1.md](CLIENT_WIRE_CONTRACT_V1.md).

`fight` создаёт quest-bound encounter с idempotency key. Повтор answer не создаёт
второй бой. Результат боя приходит отдельным domain event и продвигает objective
или scene только через объявленную связь.

Fight может объявлять authored allies и быть одним шагом bounded sequence:
`talk/use → encounter → result → следующий talk/use → encounter`. Каждый шаг
имеет свой encounter key и принимает только результат своего instance.

## Награда, выбираемая по иконке

Если node содержит `award_list`, projection отдаёт кликабельные catalog items с
`award_id`, текстом и иконкой. Клиент не разрешает продолжить без выбора и
посылает выбранный `award_id` в следующей команде. Сервер всё равно проверяет,
что id входит в актуальный список, атомарно сохраняет selection и выдаёт только
этот package. Retry не может выбрать второй вариант. Для обычной quest reward
полный рюкзак использует policy `inventory_overflow` и не блокирует завершение.

## Текст, цвет и macros

Дампы показывают HTML-подобную разметку с `<b>`, `<font color>` и macros. Однако
authoring не должен принимать произвольный небезопасный HTML как основной API.

Рекомендуемая модель:

```yaml
content:
  - { style: npc, text: "Стой!" }
  - { style: objective, text: "Найди все части амулета." }
  - { style: warning, text: "Предмет исчезнет через {remaining_time}." }
```

Style registry компилируется в точную клиентскую палитру и allowlisted markup.
Для миграции допускается `legacy_rich_text`, но publication sanitizer разрешает
только подтверждённые tags/attributes/macros. Неизвестные macros — ошибка.

Минимальные semantic styles: `npc`, `player`, `narration`, `stage`, `objective`,
`hint`, `warning`, `failure`, `success`, `location`, `reward`, `emphasis`.
Палитра является client adapter policy, а не бизнес-условием квеста.

### Предмет текстом, иконкой и конкретным экземпляром

Клиент подтверждает три разные предметные macro:

| Authoring intent          | Client macro    | Что видит игрок                           |
| ------------------------- | --------------- | ----------------------------------------- |
| `item_ref + display:text` | `ARTIFACT`      | кликабельное название типа предмета       |
| `item_ref + display:icon` | `ARTIFACT_IMG`  | кликабельную иконку с hint                |
| `item_instance_ref`       | `ARTIFACT_ITEM` | конкретный экземпляр с durability/quality |

Author никогда не вводит macro hash или сырой token. Он ссылается на catalog
key либо на именованный run asset, а projection создаёт `macros_list` и вставляет
wire token. Текст ссылки можно переопределить локализованным `label`, не меняя
сам предмет.

Ссылка на catalog item подходит для объяснения, цели и будущей награды. Ссылка
на instance допустима, только если этот экземпляр разрешается из текущего
hero/run snapshot; нельзя сохранить DB id предмета в immutable definition.

Inline content использует общий typed registry: item, money, location,
NPC/character, monster, combat, rank и подтверждённые resource images. Каждый
тип отдельно проверяется на поддерживаемых client surfaces. `MAP` и `NPC`
имеют разные действия: первый ставит цель навигатора, второй открывает карточку
NPC. Произвольный external image URL в квестовом контенте не является baseline.
Полный контракт: [RICH_CONTENT_AND_MACROS.md](RICH_CONTENT_AND_MACROS.md).

## Quest markers и answer icons

Клиент выбирает многие изображения из flags и контекста, а не из свободного URL:

- start/progress/dialog;
- main/ordinary/clan/repeat/remind/read-only варианты;
- normal answer;
- probability/check answer;
- fight answer.

Author задаёт semantic intent:

```yaml
presentation:
  marker: { role: progress, emphasis: main }
answers:
  - key: attack
    kind: fight
  - key: persuade
    kind: check
```

Client adapter выводит совместимые quest/point flags, `probability`, `to_fight`
и icon key. Нельзя вручную выбрать жёлтую иконку обычному ответу или скрыть
боевую семантику только картинкой. Explicit icon override допустим лишь из
версионированного проверенного каталога и не отменяет semantic flags.

Цвет уровня квеста, если его вычисляет клиент, не сохраняется в definition.
Отдельно сохраняется авторский style текста. Эти два понятия нельзя смешивать.

## Требования к будущему редактору

Редактор строится после server runtime, но server authoring API заранее обязан
давать ему следующие primitives:

- graph view сцен, ответов, success/failure edges и effects;
- список entries с priority и симулятором условий;
- preview для состояний offer/active/ready/outcome/history;
- кнопку «закрыть здесь и открыть снова» с показом resume result;
- визуализацию attempt policy и уже фиксируемого decision key;
- preview точного Jugger payload: текст, macros, marker и answer icons;
- lint пересекающихся entries, недостижимых узлов и unsafe markup;
- simulation без реального RNG с выбором success/failure;
- diff revision по stable keys, а не по позициям в массивах.

UI не должен иметь собственную скрытую семантику. Всё, что он редактирует,
валидируется и исполняется тем же server package.

## Открытые вопросы

- Возобновлял ли оригинальный Jugger pre-accept диалог с промежуточной точки или
  начинал его заново в отдельных цепочках?
- Какие point flags и icon variants реально используются всеми версиями клиента?
- Какова точная формула ORATORY и какие stats/modifiers видны игроку?
- Есть ли в оригинале authored повторные попытки и как они ограничены?
- Какой allowlist HTML/macros нужен для полной совместимости dumps?

Пока ответы не получены, default нового движка — безопасный
`resume_checkpoint`, single committed attempt и semantic presentation. Это
явные `PRODUCT_DECISION`, а не заявление об оригинальном поведении.
