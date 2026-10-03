# Interaction hubs, предметные диалоги, услуги и долгие активности

> Точные repeat/activity/service runtime contracts находятся в
> [REPEAT_ACTIVITIES_SERVICES_V1.md](REPEAT_ACTIVITIES_SERVICES_V1.md).

Этот документ фиксирует слой над квестовым runtime. В интерфейсе Jugger экран
NPC — это не один диалог и не список только квестов. Это **interaction board**:
единая точка входа в квесты, обычные разговоры, магазин, склад, перевозку и
другие действия. Такой же board может открывать предмет — например «Голова
мертвеца».

Главное ограничение модели: не превращать `HeroQuestRun` в владельца любого
взаимодействия. Общими являются resolver, dialog graph, presentation, typed
effects и защита от повторов; жизненный цикл принадлежит конкретному сценарию.

## Подтверждённое поведение

- один NPC одновременно предлагает несколько квестов, разговоров и услуг;
- обычный разговор может не создавать квест, иметь циклы и ответы «назад»;
- большинство quest offers проходят несколько экранов до `accept`;
- узел диалога может заменить имя и портрет говорящего;
- NPC отвечает по-разному для offer, active, ready, branch и completed;
- узел может закрыть окно и вернуть героя на карту;
- предмет способен открыть board/диалог виртуального NPC;
- использование одного предмета может открывать очередной разговор;
- ответ может атомарно списать деньги или обычные предметы;
- услуги NPC могут быть сначала куплены, а затем появиться на его board;
- перевозчик показывает направления, запускает ожидание и переносит героя;
- существуют длинные challenge tracks с отдельной периодической наградой.

## Универсальная точка взаимодействия

```text
InteractionHost (NPC | item | area | world object)
  └─ InteractionBoard
       ├─ quest_offer / quest_progress / quest_turn_in
       ├─ standalone_dialog
       ├─ activity
       ├─ store / storage
       ├─ travel_service
       └─ typed_action
```

`InteractionHost` отвечает только на вопрос «с чем взаимодействует герой».
`Presenter` отвечает на вопрос «кто сейчас говорит и что рисовать». Поэтому
предмет может быть host, «Голова мертвеца» — presenter, а отдельный узел позже
может показать другого персонажа.

Host также имеет условный `boardIntro`: постоянный текст над списком после
первого нажатия. Он выбирается по reputation/quest facts/outcomes и отличается
от label каждой строки. При пустом board клиент использует отдельный
`emptyBoardText`. Точные названия поверхностей и wire mapping описаны в
[TEXT_SURFACES_AND_QUEST_UI.md](TEXT_SURFACES_AND_QUEST_UI.md).

Каждая строка board имеет stable key, тип, priority, conditions, label,
icon/marker style и target. Resolver строит board, markers и открываемую сцену
из одного snapshot. Недоступная строка вообще не отправляется клиенту. Прямой
запрос её key/id всё равно проходит те же server-side conditions и отклоняется.

Пример:

```yaml
host: { type: npc, id: warehouse_merchant }
entries:
  - key: buy_storage_access
    type: standalone_dialog
    when: { not: { entitlement: warehouse_access } }
    target: storage_offer
  - key: open_storage
    type: service
    when: { entitlement: warehouse_access }
    target: { service: storage, id: city_warehouse }
  - key: merchant_quest
    type: quest_offer
    when: { quest_available: merchant_errand }
    target: { quest: merchant_errand, entry: intro }
```

Покупка доступа выдаёт persistent entitlement, а не «завершённый технический
квест». Квест может выдать тот же entitlement как reward. Store/storage/travel
остаются самостоятельными сервисами с собственными permission checks.

## Кто владеет состоянием

| Сценарий                              | Владелец долговечного состояния          |
| ------------------------------------- | ---------------------------------------- |
| принятый квест                        | `HeroQuestRun`                           |
| pre-accept с решением/effect          | `DialogSession`, затем связывается с run |
| безопасный обычный разговор           | stateless либо resumable `DialogSession` |
| очередной/случайный разговор предмета | `InteractionEpisode`                     |
| серия фантомов                        | `ActivityProgress`                       |
| получение периодической награды       | `RewardClaimTrack`                       |
| поездка/плавание/телепорт             | `ServiceInvocation`                      |
| купленный доступ                      | entitlement/world fact                   |

У каждого владельца есть revision, activation token и idempotency scope. Один
и тот же dialog renderer не означает один и тот же lifecycle.

## Обычные и цикличные диалоги

Dialogue graph разрешает навигационные циклы и ответы «назад». Запрет
неограниченных циклов относится к objective graph, а не к UI-навигации.

Validator разрешает цикл только если повторный проход безопасен:

- чистые `screen` и `jump` можно повторять;
- mutation/check/cost/fight/wait получают activation key и exactly-once guard;
- цикл не может бесконечно выдавать reward или создавать encounters;
- выход и auto-close всегда достижимы либо сцена явно помечена как меню;
- при reconnect восстанавливается committed checkpoint, а не новый бросок RNG.

`close_dialog` закрывает board/dialog и возвращает карту. `open_board`,
`open_service` и `jump_scene` являются отдельными navigation effects.

## Presenter и смена говорящего

Scene имеет default presenter, но любой узел может переопределить:

```yaml
presenter:
  actor: npc:captain
  name: { text: "Капитан Грум" }
  portrait: { asset: npc/captain_grum }
```

Projection обязан вернуть имя, portrait/media и оформление вместе с текстом.
Это подтверждается клиентским `NPCDialogView`: поле `npc` в ответе обновляет
данные и изображение NPC, не открывая другой экран.

## Предмет как host: «Голова мертвеца»

Обычная «Голова мертвеца» выпадает с нежити; разговор с ней запускает короткую
сцену/микроэпизод, связанную с репутацией Ведьмака. Отдельная говорящая голова
участвует в длинной цепочке «Смех сквозь слёзы». Их нельзя моделировать одной
жёстко прошитой веткой.

Предлагаемая семантика использования предмета:

1. inventory подтверждает instance и право использования;
2. resolver открывает board виртуального actor;
3. selector один раз выбирает episode по conditions/history;
4. выбор и activation token сохраняются до показа ответа;
5. закрытие/reconnect продолжает тот же episode и не позволяет reroll;
6. consume/transform предмета происходит только в объявленной commit point.

Поддерживаемые selector policies: ordered sequence, weighted, shuffle bag,
no-repeat-until-exhausted и conditional priority. Точная политика оригинальной
головы и момент расходования пока требуют wire/session research.

```yaml
selector:
  key: dead_head_conversation
  policy: shuffle_bag
  scope: hero_and_item_kind
  candidates: [plea, riddle, memory, ritual]
  persistOn: interaction_open
```

`scope` настраивается: hero, конкретный item instance, item kind, quest run или
global activity. Instance-sensitive content не должен терять identity при
stack/split/merge.

## Платные ответы и обмен

Цена — часть atomic dialog transition:

```text
проверить доступность и актуальную цену
→ зарезервировать/списать деньги и предметы
→ записать entitlement/decision/effect
→ передвинуть checkpoint
→ commit
```

Повтор команды возвращает прежний результат. Нельзя списать цену без открытия
следующего состояния или получить услугу без списания. Для предпросмотра ответ
содержит typed cost и причину недоступности, а не только текст «100 монет».

## Выбираемая награда

`reward_choice` содержит варианты с catalog reference, количеством, текстом и
иконкой. Клиент уже поддерживает `award_list`: плитка предмета выбирается
кликом, а следующий запрос несёт `award_id`.

Runtime обязан:

- требовать ровно один допустимый `award_id`, если выбор обязателен;
- повторно проверить eligibility на commit;
- одной транзакцией записать selection, выдать выбранный package и завершить
  turn-in;
- на retry вернуть тот же selection и не выдать другую награду;
- для обычных quest rewards использовать delivery policy `inventory_overflow`:
  заполненный рюкзак не блокирует сдачу и может быть переполнен.

## Fast travel как сервис

Перевозчик/капитан — provider одного `travel_service`. Его board открывает
список доступных destinations, визуально похожий на ответы диалога.

```yaml
service: travel
provider: npc:river_captain
destinations:
  - key: far_shore
    when: { location_unlocked: far_shore }
    cost: { money: 120 }
    duration: 45s
    arrival: { location: far_shore, spawn: pier }
    waiting:
      title: "Путешествие к Дальнему берегу"
      presenter: npc:river_captain
      picture: npc/river_captain_travel
```

После выбора создаётся persistent `ServiceInvocation` со snapshot маршрута,
цены, времени и arrival point. Reconnect/restart возвращает remaining time;
terminal worker идемпотентно завершает ровно одну поездку. Quest facts могут
открывать destination, но поездка не становится quest objective автоматически.

Из описания владельца известно, что деньги визуально списываются в конце.
Точный серверный договор ещё исследуется. Безопасный целевой вариант:
зарезервировать сумму при старте, а debit и relocation атомарно подтвердить при
успешном окончании. Cancellation/refund, бой/смерть, недостаток денег к концу и
disconnect должны быть закреплены отдельным parity test до реализации.

## «Сферы мага» как ActivityTrack

Сценарий Ангальда Д'Аро — не repeatable quest целиком:

- герой последовательно вызывает экспериментальных фантомов уровней 10–45;
- прогресс между посещениями сохраняется;
- примерно каждые три победы улучшается tier сферы;
- доступную сферу получают отдельным диалогом;
- claim имеет собственный недельный cooldown;
- выданная сфера действует ограниченное время;
- следующий бой и получение сферы — разные команды и разные idempotency keys.

Поэтому нужны два связанных агрегата:

```text
ActivityProgress(activity_key, hero_id, revision_id,
                 current_challenge, completed_challenges, unlocked_tier)
RewardClaimTrack(activity_key, hero_id, claim_key,
                 last_claimed_tier, cooldown_until, claim_count)
```

Challenge start создаёт bounded encounter с объявленными врагами и союзниками.
Победа продвигает ровно один challenge. Claim snapshot-ит текущий unlocked tier,
выдаёт соответствующую сферу и запускает настраиваемый cooldown. Изменение
длительности cooldown в нашей игре является content config, а не патчем кода.

Точное число испытаний, milestone table, поведение проигрыша и возможность
повторного боя до победы должны быть подтверждены дампом/wire перед наполнением.

## Связь с профессиями и доступом к миру

Quest rewards могут выдавать profession entitlement и location unlock. Для
основных профессий действуют две независимые cardinality slots:

- не более одной основной собирательной;
- не более одной основной производящей;
- любую допустимую собирательную можно сочетать с любой производящей;
- рыбалка, кулинария и другие дополнительные профессии не занимают эти slots.

Первичное получение профессии выполняется только reward при сдаче квеста;
первый рецепт выдаётся предметом. Замена профессии — отдельный будущий flow,
который сбрасывает старую и выдаёт новую; в первый runtime slice не входит.

## Открытые исследования

1. Точная политика очередности обычной «Головы мертвеца», consume point и
   появляется ли новый разговор на каждый use или после завершения эпизода.
2. Полная таблица фантомов/tiers сфер, defeat/retry и точный claim cooldown.
3. Wire перевозчиков: момент списания, interrupt/refund и reconnect payload.
4. Правила time-of-day availability и часовой пояс сервера.
5. Формат location unlock и способ скрытия/блокировки переходов.
6. Lifecycle стартового помощника профессии.
