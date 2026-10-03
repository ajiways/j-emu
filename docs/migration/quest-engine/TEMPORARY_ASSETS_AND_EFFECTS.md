# Quest engine: временные предметы, эффекты и scoped progress

> **Статус:** целевой контракт на основании `JUGGER_CONTENT`. Точные duration,
> wire countdown и offline-time правила требуют проверки для каждого
> переносимого квеста.

## Одна дата истечения — не модель поведения

Временность может принадлежать разным сущностям:

- item instance исчезает в заданный момент;
- effect instance перестаёт разрешать действие;
- временный NPC/ally доступен ограниченное время;
- interaction window закрывается и выбирает другой outcome;
- progress scope существует только пока жив конкретный effect instance;
- сам run или objective имеет deadline.

Поэтому `expiresAt` хранится у конкретного instance, а реакция на expiry
задаётся definition policy. Движок не должен автоматически проваливать квест,
обнулять весь run или молча выдавать новый предмет.

## Что уже есть в `j-emu`

`InventoryItem` уже хранит unix `expire`, поддерживает location `tempeffect` и
умеет превратить использованный напиток во временный effect. Wire projection
также отдаёт `expire` для tempeffect. Это полезный inventory primitive, но ещё
не quest contract.

Текущий `purgeExpiredDrinks` удаляет истёкшие tempeffects при bootstrap героя и
перед использованием артефакта. Он не публикует typed expiry event для quest
engine, не знает owner run/generation и не может выбрать recovery/reset policy.
Поэтому этот код можно переиспользовать только после добавления корректной
boundary/event semantics; наличие поля `expire` не закрывает QE-05/QE-06.

## Подтверждённые паттерны

### Обновить effect и сохранить progress

В `Кристаллическом амулете` Покров демонолога действует ограниченное время.
После истечения игрок возвращается к Варгуле, чтобы обновить защиту. В тексте
не указано, что уже сделанный progress сбрасывается.

```text
effect expires → objective blocked → recovery NPC reissues effect
               → прежний progress сохраняется
```

### Обновить effect и сбросить локальный progress

В `Вожделенных душах` герой должен убить 10 Душеловов под Саваном-невидимкой.
Саван можно получить снова, но при его истечении счётчик уничтоженных
Душеловов сбрасывается.

```text
effectInstance E1 owns progress scope P1
E1 expires → close P1 with reason expired
reissue E2 → create empty progress scope P2
```

Старые kill events E1 не могут быть применены к P2. Это та же задача
идемпотентности, что iteration token у bounded repeat.

### Временные союзники

В `Новых сюрпризах Альвеариума` воины Братства помогают герою 15 минут. Здесь
истекает encounter assistance/roster modifier, а не квест целиком. После
истечения уже убитые стражи не обязаны воскресать или исчезать из progress.

### Временное окно с альтернативным outcome

В `Пути ведьмака` взаимодействие с могилой может успеть запечатать её сразу
или вызвать Смертомора при опоздании. Оба пути потенциально завершают одну
могилу, но имеют разные effects, тексты и consume timing.

## Instance model

### TemporaryAsset

Минимальные поля:

- `instanceId`, `ownerHeroId`, optional `runId/nodeId`;
- `kind`: item/effect/permission/ally/window;
- `issuedAt`, optional `expiresAt`;
- `clockPolicy`: wall-clock либо online-play-time, только по evidence;
- `expiryPolicyId`;
- `generationToken` для reissue;
- lifecycle `active|reserved|consumed|expired|revoked`;
- idempotent grant/expiry operation ids.

Временный quest item остаётся записью inventory и asset ledger; quest engine
не заводит параллельный «виртуальный инвентарь».

### Progress scope

Objective явно выбирает:

- `run` — progress переживает reissue effect;
- `node_activation` — reset при переоткрытии node;
- `asset_generation` — привязан к конкретной выдаче временного item/effect;
- `repeat_iteration` — привязан к iteration token;
- `interaction_window` — принадлежит одному запущенному ожиданию.

Expiry policy указывает `resetScope`, а не произвольный список счётчиков.
Validator проверяет, что scope принадлежит текущей ветке и не затрагивает
requirements вне объявленной reset boundary.

## Expiry policies

Definition выбирает named policy:

| Policy                  | Результат                                                   |
| ----------------------- | ----------------------------------------------------------- |
| `block_until_reissue`   | progress хранится, новые события не засчитываются           |
| `reissue_keep_progress` | открывается recovery, прежний scope продолжает жить         |
| `reissue_reset_scope`   | recovery создаёт новое generation и пустой progress scope   |
| `fallback_outcome`      | interaction переходит к authored альтернативе               |
| `reopen_acquisition`    | зависимая ветка откатывается к получению asset              |
| `cancel_run`            | полный authored reset; только при явном продуктовом решении |
| `terminal_failure`      | запрещено до решения QR-01 и client projection              |

Policy может дополнительно отправить typed chat/plaque/popup и очистить
только принадлежащие scope temporary effects.

## Timer semantics

Каждый timer обязан определить:

- точку старта: grant, accept, node activation, action start или first progress;
- clock source и точность;
- идёт ли время offline;
- что происходит ровно на границе `expiresAt`;
- кто materialize expiry: request-time catch-up и/или scheduler;
- какой payload получает клиент;
- что делает cancel/restart/definition rollout;
- можно ли продлить существующий instance или выдаётся новая generation.

Timestamp является источником истины. In-memory timer только будит обработчик;
после restart request-time catch-up обязан получить тот же результат.

## Гонки на границе времени

Команда использования и expiry сериализуются по hero/run/asset lock. Решение
принимается по серверному времени внутри транзакции:

- если use принят до `expiresAt`, его transition либо полностью коммитится,
  либо полностью откатывается;
- если asset уже expired, item/effect не consume повторно, выполняется expiry
  policy;
- duplicate expiry event не создаёт вторую выдачу и второй reset;
- late domain event со старым `generationToken` игнорируется для нового scope.

## Потеря временного предмета

Drop, destroy, wrong use и expiry — разные причины. Они могут вести к одной
recovery policy, но сохраняются раздельно для текста и аналитики. Например:

```text
drop       → NPC: «Я дам ещё один экземпляр»
wrong use  → plaque, item остаётся
expire     → item исчезает, objective reset до acquisition
consume ok → persistent run fact; replacement больше не нужен
```

Если предмет был выдан для доставки, validator требует путь из любого
разрешённого состояния потери обратно к достижимому terminal node. Если
reissue может фармить обычную ценность, новый instance остаётся quest-bound и
не может быть promoted в permanent reward.

## Что должен показывать будущий редактор

Для каждого temporary asset/effect:

- timeline старта, expiry и reissue;
- область progress, которая будет сохранена или сброшена;
- отдельные outcomes drop/wrong-use/expiry;
- affected nodes и projections;
- предупреждение о timer без recovery;
- симуляцию «истёк до действия», «действие на границе», restart и duplicate
  event.

Редактор не должен предлагать один checkbox «временный»: он скрывает решения,
которые непосредственно меняют игровой сценарий.
