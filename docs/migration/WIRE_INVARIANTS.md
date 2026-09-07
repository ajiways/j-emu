# Инварианты wire-протокола

## Статус документа

Это минимальный обязательный контракт миграции с существующим Flash/CEF-клиентом. Он составлен по ограниченному набору просмотренных документов, старого runtime и исследовательских заметок. Документ **не** доказывает исчерпывающий паритет с live, всеми дампами или всеми OA. Неописанное поле нельзя автоматически удалять или изобретать: сначала нужен дамп, AS3-свидетельство либо воспроизводимый клиентский тест.

Приоритет доказательств для новых уточнений:

1. воспроизводимый live dump;
2. поведение/парсер клиентского AS3;
3. сохранённый binary fixture с известным происхождением;
4. проверенное поведение старого runtime;
5. документация;
6. гипотеза — только с явной пометкой, не как инвариант.

Просмотренные опорные источники:

- [`jgr-emu/docs/PROTOCOL.md`](../../../jgr-emu/docs/PROTOCOL.md);
- [`jgr-emu/docs/ARCHITECTURE.md`](../../../jgr-emu/docs/ARCHITECTURE.md);
- [`_research/02_protocol.md`](../../../_research/02_protocol.md);
- [`jgr-emu/src/routes/entryPoint.ts`](../../../jgr-emu/src/routes/entryPoint.ts);
- [`jgr-emu/src/routes/esrv.ts`](../../../jgr-emu/src/routes/esrv.ts);
- [`jgr-emu/src/fight/dispatch.ts`](../../../jgr-emu/src/fight/dispatch.ts);
- [`jgr-emu/docs/FIGHT_CAST_ACK.md`](../../../jgr-emu/docs/FIGHT_CAST_ACK.md).

## URL и транспорт

Клиентский origin для production-like запуска — `https://s1.jugger.ru:443`. Dev HTTP `:8080` полезен разработчику, но не заменяет проверку старого CEF по целевому origin.

| Назначение                   | Точный метод и путь                                                                                             | Тело/ответ                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Game OA                      | `POST /entry_point.php?ux=<timestamp>`; сервер обязан принимать сам путь `/entry_point.php` независимо от query | Bare AMF3 object без length prefix; ответ — bare AMF3 object                                              |
| Chat/hunt/presence long-poll | `POST /esrv//<token>`; серверный route должен покрывать `/esrv/*`                                               | Исходящие события — MULTI: повторяющиеся `[u32 big-endian length][AMF3 object]`; пустая очередь допустима |
| Fight HTTP proxy             | `POST /fproxy//<token>`; route также покрывает `/fproxy`, `/fproxy/`, `/fproxy/*`                               | Команды SINGLE — bare AMF3; poll-ответы MULTI с тем же `u32be + AMF3` framing                             |
| Fight TCP fallback           | `host:port` из `fight\|conf`, исторически `s1.jugger.ru:33120`                                                  | Length-prefixed AMF; не менять контракт только потому, что основной путь использует fproxy                |
| Статика клиента              | `GET /Pub1/**` в архитектурном контракте миграции                                                               | Файлы должны отдаваться под клиентскими путями без переписывания AMF-содержимого                          |
| Login                        | `GET/POST /login`, также `GET /login.php`; `GET/POST /register`                                                 | HTML/form flow, не AMF                                                                                    |
| Игра                         | `GET /game.php`                                                                                                 | HTTP 200 со страницей, FlashVars и установкой cookie после login redirect                                 |
| Dev login                    | `GET /soc_auth.php?slot=N`                                                                                      | Не wire live; допустим только как явно dev-only поверхность                                               |

Источники путей: [`docs/ARCHITECTURE.md`](../../../jgr-emu/docs/ARCHITECTURE.md), [`src/main.ts`](../../../jgr-emu/src/main.ts), [`src/routes/esrv.ts`](../../../jgr-emu/src/routes/esrv.ts), [`_research/02_protocol.md`](../../../_research/02_protocol.md).

### Framing AMF

OA request:

```text
AMF3 {
  object: string,
  action: string,
  form?: object,
  in?: object,
  sq: number
}
```

`/entry_point.php` не использует HTTP form parser и не имеет внешнего length prefix. `sq` из запроса зеркалируется в OA-ответе. Глобальная регистрация form-body parser недопустима, если она перехватывает raw AMF body; старый runtime регистрировал её только в auth scope. Источники: [`src/routes/entryPoint.ts`](../../../jgr-emu/src/routes/entryPoint.ts), [`src/main.ts`](../../../jgr-emu/src/main.ts).

MULTI — это конкатенация нуля или более кадров:

```text
[4 bytes unsigned length, big-endian][exactly length bytes of one AMF3 object]
```

Нельзя выдавать bare массив вместо кадров или добавлять length prefix к OA. Chat auth `{rc:"auth", eid:1, ...}` на `/esrv/*` является SINGLE и получает пустой HTTP body, а не MULTI wrapper. Источник: [`src/routes/esrv.ts`](../../../jgr-emu/src/routes/esrv.ts).

Для fproxy команды `auth`, `castSpell`, `persInfo`, `leaveFight` разбираются как SINGLE bare AMF3; совместимый decoder может принять исторический length-prefixed request, но encoder не должен самовольно смешивать режимы. Long-poll отдаёт MULTI. Для успешного `castSpell` HTTP response остаётся пустым, а `{rs,sq}` и эффекты приходят через конкурентный poll. Источник: [`src/fight/dispatch.ts`](../../../jgr-emu/src/fight/dispatch.ts).

## OA envelope и плоские ответы

Обычный ответ:

```text
{
  "<object>|<action>": { status, ... },
  state?: { ... },
  sq
}
```

Исключение старого клиента: запрос `object=common, action=object` отвечает блоком `common|action`, а не `common|object`. Источник: [`src/routes/entryPoint.ts`](../../../jgr-emu/src/routes/entryPoint.ts).

### `common|init` и `common|init2`

Оба bootstrap-ответа **плоские**: `common|init`/`common|init2`, `state`, `user|bag`, `user|pocket`, `user|skills`, `user|conf`, остальные блоки и `sq` являются соседями на верхнем уровне.

Запрещённая форма:

```text
{ "common|init": { "user|bag": {...}, "state": {...} } }
```

Клиент парсит bootstrap-блоки только сверху; вложение приводит к неполному UI/зависанию загрузки. Состав должен строиться из актуального player-state и каталога, а не клонированием старого `.bin`. Источники: [`docs/PROTOCOL.md`](../../../jgr-emu/docs/PROTOCOL.md), [`src/routes/entryPoint.ts`](../../../jgr-emu/src/routes/entryPoint.ts).

Критические поля `user|personal_details.info`, если миграция сохраняет отключённый tutorial flow:

```text
finished_first_fight: "1"
tutorial2: "{\"finished\":true}"
```

Без них клиент может включить tutorial и заблокировать основной UI. Источник: [`docs/PROTOCOL.md`](../../../jgr-emu/docs/PROTOCOL.md).

### Экипировка и инвентарные мутации

Успешные PUT_ON/PUT_OFF должны возвращать flat response с согласованными соседними блоками, как минимум:

```text
common|action
user|bag
user|view
user|pocket
user|skills
state
sq
```

Фактический состав конкретной мутации фиксируется fixture-тестом; нельзя вкладывать эти блоки внутрь `common|action`. Старый клиент не гарантирует самостоятельную полную пересборку UI по одному `{status:100}`. Источники: [`docs/PROTOCOL.md`](../../../jgr-emu/docs/PROTOCOL.md), [`docs/ARCHITECTURE.md`](../../../jgr-emu/docs/ARCHITECTURE.md).

## Status и текст ошибок

| `status` | Семантика                       | Поле пользовательского текста         |
| -------: | ------------------------------- | ------------------------------------- |
|    `100` | Успех                           | `msg_text`, если нужна SIMPLE_MESSAGE |
|      `4` | Нет сессии/авторизации          | `error`                               |
|    `203` | Операция невозможна / запрещена | `error`                               |
|    `204` | Ошибка операции                 | `error`                               |

Правила:

- `4` нельзя использовать как обычную gameplay-ошибку: клиент трактует его как потерю авторизации.
- На `203`/`204` нельзя класть текст только в `msg_text`; Flash ожидает `error` и иначе способен показать буквальное «error».
- Неизвестная или пока не реализованная операция получает честный совместимый `203`, а не фиктивный `100` с пустыми данными.
- `status:100 + msg_text` — простая плашка. `npc|answer` — NPC-диалог. `common|window` — отдельное server window; эти поверхности не взаимозаменяемы.
- AREA popup после waiting идёт через `common|action_finish.msg_text`, если именно эта форма подтверждена сценарием.

Источники: [`docs/PROTOCOL.md`](../../../jgr-emu/docs/PROTOCOL.md), обработка no-auth в [`src/routes/entryPoint.ts`](../../../jgr-emu/src/routes/entryPoint.ts).

## Сессии и cookies

| Cookie      | Контракт                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------- |
| `PHPSESSID` | Основной идентификатор сессии; проверяется сервером                                          |
| `sess_key`  | Вторичный ключ; нельзя валидировать строго, поскольку CEF может прислать устаревшее значение |
| `sess_uid`  | Account id для клиентского flow/lookup                                                       |
| `cid`       | То же account id в ожидаемом клиентом имени                                                  |
| `sstype`    | Тип социальной сети; старый flow выдавал `"18"`                                              |

CEF ненадёжно сохраняет `Set-Cookie` из HTTP 302. Обязательный flow:

1. login создаёт сессию;
2. 302 ведёт на `/game.php?_s=<PHPSESSID>&_k=<sess_key>&_u=<accountId>`;
3. `/game.php` проверяет токены и устанавливает пять cookies в **HTTP 200**;
4. страница убирает токены из видимого URL;
5. последующие OA проверяют прежде всего `PHPSESSID`.

Запрещено считать cookie, выданные только в 302, достаточной проверкой совместимости. Источники: [`src/routes/auth.ts`](../../../jgr-emu/src/routes/auth.ts), [`docs/PROTOCOL.md`](../../../jgr-emu/docs/PROTOCOL.md).

## Предметы и идентификаторы

### Общая ID policy

Persistent ID выдаёт PostgreSQL identity/sequence с `1`. Крупные live ID не
являются зарезервированными floors. Human participant ID равен numeric
`heroes.id`; fight bot ID существует только в RAM боя и начинается с
`1_000_000`. Ноль запрещён, кроме `answer_id=0` (доска) и `instance_id=0`
(мир); верх wire integer — `2_147_483_647`.

Map hunt ID равен `area × 100 + index`; dungeon hunt ID уникален в том же
`common|hunt`. BG и dungeon instance copies различаются типом, а не диапазоном.
Полный канон: [`docs/ID_RANGES.md`](../../../jgr-emu/docs/ID_RANGES.md) и
[ADR-0016](../adr/ADR-0016-live-derived-id-allocation.md).

### Bag shape

Ключ предмета в `user|bag.bag` — строковое представление instance id. Предмет в рюкзаке имеет `action:"bag"`. Для корректной вкладки и изображения необходимы подтверждённые `type_id`, `kind_id`, `picture`; `artikul_id` ссылается на шаблон, а `actions`, `artifact_actions`, `artifact_skills` управляют доступными действиями и отображением. Пустой `artifact_actions` не должен порождать кнопку USE. Источник: [`docs/PROTOCOL.md`](../../../jgr-emu/docs/PROTOCOL.md).

### Безопасный диапазон instance id

`persSpells.srcId` равен реальному `items.id`. Клиент ищет инстанс **без** `srcType`, поэтому id не должен совпадать с native 1/2/3/5/6/7/10 и с artikul перчатки. Миллиард не контракт Flash; целевой пол **100_000**, потолок int32. Канон: [`docs/ID_RANGES.md`](../../../jgr-emu/docs/ID_RANGES.md).

Новый runtime не «поднимает» уже выданный ID арифметикой. PostgreSQL sequence сразу выдаёт значение из зарегистрированного диапазона. Namespaces: [ID_POLICY.md](../architecture/ID_POLICY.md).

## `rs`, strike и клиентские счётчики

`rs=true` — не нейтральный ack: клиент сам уменьшает pocket count, glove combo points и native aggro/rage. Поэтому порядок пакетов внутри одного poll является частью состояния, а не косметикой.

| Действие                           | Обязательный порядок в poll | Клиентский side effect                                                   |
| ---------------------------------- | --------------------------- | ------------------------------------------------------------------------ |
| Melee / ending native, `srcType:1` | **strike → `{rs,sq}`**      | Ранний голый `rs` может неверно вспыхнуть панель хода                    |
| Ярость, `srcType:1, srcId:6`       | **`{rs,sq}` → strike**      | `ProcessNative` сбрасывает клиентскую rage до абсолютного события        |
| Разозлить, `srcType:1, srcId:7`    | **`{rs,sq}` → strike**      | Клиент делает `aggro - 1`; последующий `persSpells.count` задаёт абсолют |
| Pocket, `srcType:2`                | **`{rs,sq}` → strike**      | `SpellCountDecById(-1)`                                                  |
| Glove, `srcType:3`                 | **`{rs,sq}` → strike**      | `ProcessGauntlet(-cpCost)`, затем абсолютный `persCP`                    |

Дополнительные инварианты:

- Успешный pocket use серверно списывает одну единицу и обычно не шлёт `persSpells` в том же strike: клиент уже сделал `-1` на `rs`.
- При deny, который всё же требует `rs`, абсолютный `persSpells.count` идёт **после** `rs` и восстанавливает UI.
- Cooldown deny: HTTP `{rs:false}` без poll и без `persSpells` resync, чтобы не списать заряд и не сбросить клиентский cooldown overlay.
- Glove списывает `cp - cost`, не обнуляет cp; абсолютный `persCP` идёт после `rs`.
- Kind 11 без подходящей цели/эффекта: HTTP `{rs:false, restriction:18, sq}`, не poll `rs:true`.
- Для ending action старый grant/timer очищается **до** resolve. Иначе kill/switch может создать новый `attacknow`, который последующая очистка удалит.
- Пакеты одного действия должны попадать в очередь до единого flush; раздельная отправка может нарушить наблюдаемый порядок.

Источники: [`docs/FIGHT_CAST_ACK.md`](../../../jgr-emu/docs/FIGHT_CAST_ACK.md), [`docs/POCKET.md`](../../../jgr-emu/docs/POCKET.md), реализация очереди и `rsBeforeStrike` в [`src/fight/dispatch.ts`](../../../jgr-emu/src/fight/dispatch.ts).

## Realtime channels

Каждый esrv MULTI-кадр содержит:

```text
{ channel, ctime, object: { "<object>|<action>": ... } }
```

Канал и назначение:

| Channel         | Назначение                                  |
| --------------- | ------------------------------------------- |
| `2:<accountId>` | Персональные события: loot, windows, `fight | exit`, личные trade/session события |
| `4:<partyId>`   | Party fan-out и party chat                  |
| `131:<areaId>`  | Hunt, population и area-scoped события      |

События должны находиться внутри `packet.object`. Bare top-level `fight|exit` в esrv-пакете игнорируется клиентским ChatDummy. Когда `fight|loot` и `fight|exit` готовы вместе, они объединяются в один personal object с порядком, позволяющим применить loot до exit. Hunt строится в контексте конкретного героя/instance copy, а не только глобального area id.

Источники: [`src/routes/esrv.ts`](../../../jgr-emu/src/routes/esrv.ts), [`docs/PROTOCOL.md`](../../../jgr-emu/docs/PROTOCOL.md).

## Завершение боя

После fproxy `fightFinish` клиент ожидает `fight|exit` через realtime; без него result flow может ждать около 60 секунд. `fight|exit` идёт внутри esrv personal packet (`2:<accountId>`). Ответ `fight|finish` не должен без подтверждённого fixture самовольно включать `common|area_conf`, поскольку это ломало ResultWaiting в просмотренном контракте.

`fight|conf` сохраняет клиентские имена полей (`host`, `port`, `proxy`, `fightId`, `userId`, `fightAkey`, `bg`, `persSelf_sk`, `persSelf_body`, `can_leave`, `instance_id`, `flags`); не переименовывать их ради внутренней модели. Старый builder: [`src/fight/wire.ts`](../../../jgr-emu/src/fight/wire.ts). Исследовательское основание finish/exit: [`_research/02_protocol.md`](../../../_research/02_protocol.md).

## Денежная семантика

Имена live контринтуитивны и не подлежат «исправлению» на wire:

| Поле                              | Значение       |
| --------------------------------- | -------------- |
| `money` / `award.money`           | Золотые монеты |
| `money_gold` / `award.money_gold` | Алмазы         |

В БД допустимы внутренние типы/названия, но encoder обязан восстановить эти ключи и не поменять валюты местами. Денежные значения старого state хранились строками (`"25.00"`); смена wire-типа возможна только после отдельного клиентского доказательства. Источник: [`docs/ARCHITECTURE.md`](../../../jgr-emu/docs/ARCHITECTURE.md), раздел `heroes`.

## Минимальные contract tests

До реализации игровых формул должны существовать проверки:

1. OA bare AMF3 round-trip и зеркальный `sq`.
2. Ноль, один и несколько MULTI-кадров с точным big-endian length.
3. No-auth `status:4 + error`; gameplay deny `203 + error`.
4. Flat `common|init`, `common|init2`, PUT_ON и PUT_OFF без вложенных sibling blocks.
5. Cookie выдаются в 200 `/game.php`, а не только в 302.
6. Item instance id не пересекается с native 5/6/7 и одинаков в init, pocket и `persSpells`.
7. Persisted wire ID после restart продолжает DB sequence и не повторяется.
8. Порядок melee, pocket, glove, rage и aggro пакетов проверяется как упорядоченная последовательность.
9. esrv payload находится в `packet.object` и использует правильный `2:`/`4:`/`131:` channel.
10. `fightFinish → fight|exit → finish/loot` не оставляет клиент в ResultWaiting.
11. `money` и `money_gold` сериализуются в правильные валюты.

Прохождение этих тестов означает соответствие только перечисленным инвариантам, а не полный wire parity.
