# Обновление локального Pub1 у клиента

Как CEF-лаунчер качает/проверяет кэш `Pub1/`, и почему «положить новый `quest_info.amf` на emu» само по себе не гарантирует, что Windows-клиент его увидит.

Смежное: маркеры квестов и вариант «свой AMF» — [QUEST_MAP_MARKERS.md](../../server/docs/QUEST_MAP_MARKERS.md); роутинг hosts/TLS — [REDIRECT.md](../../server/docs/REDIRECT.md); evidence — [`_research/01_architecture.md`](../../_research/01_architecture.md), [`_research/samples/CLIENT_ROUTING.md`](../../_research/samples/CLIENT_ROUTING.md), [`_research/client_log_2026-08-11/`](../../_research/client_log_2026-08-11/README.md); switcher — [`tools/jugg-switch/README.md`](../../tools/jugg-switch/README.md).

Это **не** OA-пуш и не правка Flash. Клиент уже умеет качать статику; задача — встать в его пайплайн версий.

---

## Два слоя (не путать)

```
┌─────────────────────────────────────────────────────────────┐
│  juggernautclient.exe (CEF launcher)                        │
│  1) UPDATE: static.jugger.ru → Build1.lst / файлы → Pub1/   │
│  2) GAME:   s1.jugger.ru/game.php → Flash читает из кэша    │
└─────────────────────────────────────────────────────────────┘
```

| Слой                          | Кто                    | Host                                     | Что решает                                                              |
| ----------------------------- | ---------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| **A. Лаунчер / кэш на диске** | native updater         | `static.jugger.ru`                       | Какие файлы лежат в локальном `Pub1/` (md5 / version)                   |
| **B. Flash runtime**          | AS3 `ResourcesManager` | same-origin `s1` (или путь из FlashVars) | Какой URL открыть **из уже скачанного** кэша (+ `?ux=` anticache в URL) |

Пока `s1.jugger.ru` смотрит на `j-emu` / stub, слой B не читает install-dir. Страница `game.php` грузит ролик с того же origin, а `PUB1_DIR` раздаётся с корня сайта. Локальный `C:\VK Play\Джаггернаут\…\Pub1` при этом не используется: подмена и даже удаление файлов там картинку не меняют, и updater их не докачивает (`Unable to check package` на `static.jugger.ru`).

Подтверждено 2026-10-03 на кнопке «Премиум». Класс `modules.topmenu.TopMenu` в `Pub1/images/swf/main.swf` собран заново через FFDec `-importScript`: из массива верхней полоски убран `TopMenuActions.PREMIUM`, слотов в `new Menu(...)` стало 11 вместо 12. Пока подменённый ролик лежал только в каталоге установки, кнопка оставалась. Как только тот же файл заменил `Pub1/images/swf/main.swf`, который отдаёт сервер, кнопка пропала. `main_ui.swf` содержит ту же полоску, но `game.php` вшивает `images/swf/main.swf?ux=emu`. Хвост `ux=emu` — постоянная метка в URL, не режим; CEF может держать предыдущий ответ, пока клиент не перезапущен.

Оригинал этого прогона: `_research/client-mod/main.original.swf` (2 306 211 байт, md5 `94d8213534b8f5ad1651ca688d3ec499`). Сборка без кнопки: `_research/client-mod/main.swf` (2 309 055 байт, md5 `2719097dcb7fe3f90224da0475acffec`). `Build1.lst` по-прежнему описывает оригинал; на этот запрос манифест не влияет.

---

## Слой A — манифест и updater

### Запрос при старте

Каждый запуск (лог клиента):

```
https://static.jugger.ru/chrome/update.php
  ?project=juggernautclient&version=103&revision=66505&…
```

Fingerprint из лога: `Client=2.0.103.66505`, `BuildId: cur=103 new=103`.

Hosts для stub/emu обычно режут и `s1`, и `static` на наш IP (`jugg-switch`). Пока stub **не** отдаёт полноценный no-update / свой манифест, типично:

- `OnUmsCheckVersion 1` / `Unable to check package`;
- клиент **продолжает** со старым локальным кэшем.

### Манифесты

В install / репо:

| Файл                  | Роль                                                    |
| --------------------- | ------------------------------------------------------- |
| `Build1.lst`          | основной пакет графики/AMF (~1 GB, десятки тысяч строк) |
| `Build1.ver`          | одно число версии манифеста (например `16717`)          |
| `Build2.lst` / `.ver` | маленький доп. пакет                                    |

Формат строки `Build1.lst` (tab-separated):

```
<path>	<version_or_mtime>	<size>	<md5>
```

Пример:

```
images/locale/ru/amf/quest_info.amf	1361528837	26355	d7a09e2e1f2ec46cd73072d3228881f4
images/locale/ru/pack.cfg	1785489746	1898278	4286b1b19e8064e60b312c807687a61d
```

Первая строка файла — число записей. Лаунчер сравнивает local vs remote (`Content: Build1.lst cur=… new=…`) и докачивает изменившиеся path (по version/md5). Качает **лениво**: запись в lst ≠ файл уже на диске.

Репо: корневой `Build1.lst`; свежий снимок — `data-from-used-live-client/Build1.lst` + `.ver`.

### Где лежит кэш

Локальный каталог клиента (не обязательно git `Pub1/`). Emu/`stub` отдаёт `GET /images/**` из репозиторного Pub1 для **game origin**; updater ходит на **другой** host и пишет в install Pub1.

---

## Слой B — Flash читает AMF

После UPDATE клиент открывает `https://s1…/game.php`. Flash:

1. Грузит `pack.cfg` с anticache:  
   `localePath + "pack.cfg?" + Date.now()` (`Main.as` → `amfAntiCacheString`).
2. `CfgParser.UnpackAMFCfg` → map имя → URL, например:  
   `quest_info=images/locale/ru/amf/quest_info.amf?ux=1361528837`
3. `Links.GetAmfLink("quest_info")` → этот URL.
4. `ResourcesManager.requestFiles` качает бинарник (обычно из уже локального кэша / same host).

`?ux=<n>` в `pack.cfg` — **версия в URL**. Число для `quest_info` сейчас совпадает с полем version в `Build1.lst` (`1361528837`).  
`localAnticache` в AS3 добавляет `Math.random()` только на `juggernaut.local` — на live/emu не спасает от устаревшего файла, если URL/`ux` и байты на диске старые.

Итог: чтобы Flash увидел новый `quest_info.amf`, нужно чтобы:

1. файл попал в **локальный** Pub1 клиента (слой A или ручная подмена), **и**
2. `pack.cfg` указывал актуальный `?ux=` (иначе возможен кэш по старому URL / путаница с манифестом).

---

## Что нужно для «кастомного патча AMF» (флоу)

Минимальный осмысленный pipeline (ещё не сделан end-to-end в emu):

```
authored JSON / DB
  → encode AMF3 (quest_info.amf)
  → положить в отдаваемый Pub1
  → пересчитать md5 + version
  → обновить строку в Build1.lst (+ Build1.ver++)
  → обновить pack.cfg: quest_info=…?ux=<new_version>
  → updater на static.jugger.ru отдаёт новый lst / файлы
  → клиент при старте докачивает diff
  → Flash грузит новый ux
```

### Компоненты, которых не хватает или слабо закрыты

| Кусок                                            | Статус / заметка                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `encodeAmf3` на сервере                          | есть codec; нужен exact shape под `QuestDataParser`                              |
| Отдача файла с `s1` `/images/...`                | ✅ stub/server `@fastify/static` Pub1                                            |
| `GET static…/chrome/update.php`                  | live updater; stub/emu **не** полноценный SoT (часто fail → старый кэш)          |
| Отдача `Build1.lst` / `.ver` / файлов с `static` | hosts уже режет `static` на stub IP; ответа «вот новый манифест» нет             |
| Автоbump `pack.cfg` `ux=` + lst md5              | нет пайплайна                                                                    |
| Dev bypass                                       | ручная замена файла в install Pub1 + правка `pack.cfg` / wipe кэша — для отладки |

Пока updater не наш — надёжный dev-путь: править файл **в каталоге клиента** (или синхронизировать репо Pub1 → install) и поднимать `ux` / чистить кэш CEF (`jugg-switch` умеет cookies wipe; полный wipe Pub1 — отдельно).

---

## Связь с маркерами «!»

Вариант B в [QUEST_MAP_MARKERS.md](../../server/docs/QUEST_MAP_MARKERS.md) («свой `quest_info.amf`») **упирается в этот документ**, не в OA:

- недостаточно encode + файл в git Pub1;
- нужен флоу, чтобы **лаунчер** подтянул байты и **Flash** взял новый `ux`.

Пока флоу нет — остаётся workaround через `finished_quests_id` (`mapOfferMarkers.ts`).

Вариант A (live `book_id` = `quest_info.quest_id`) **не** требует патча AMF и updater — только честный прогресс в книге.

---

## Практические рычаги сейчас

| Цель                                        | Действие                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Играть на emu без live CDN                  | hosts: `s1` + `static` → stub IP; cert с SAN на оба ([jugg-switch](../../tools/jugg-switch/README.md))                                |
| Подменить SWF/картинку, которую рисует игра | файл в **серверном** `Pub1` (`PUB1_DIR`, для `main.swf` — `images/swf/main.swf`) и перезапуск клиента. Каталог установки игнорируется |
| Убедиться, что клиент не на live статике    | лог: `----START UPDATE----`, `Unable to check package`, `Build1.lst cur/new`                                                          |
| Долгосрочно свой каталог                    | реализовать ответ `chrome/update.php` + раздача lst/файлов + encode pipeline                                                          |

---

## Открытые вопросы (дописать по мере раскопа)

1. Точный wire-ответ live `chrome/update.php` (когда `new != cur`, URL пакетов, подпись).
2. Алгоритм сравнения: только `.ver`, или построчный md5 lst.
3. Откуда клиент качает файлы после ok update — тот же `static`, CDN path, или `s1`.
4. Достаточно ли bump `ux` в `pack.cfg` без смены md5 в lst, если файл уже подменили на диске вручную.
5. Нужен ли no-update stub (всегда `cur=new`), чтобы не ломать старт при offline static.

Evidence для п.1–3 копить в `_research/client_log_*` / Charles на `static.jugger.ru`.

---

## Быстрые отсылки

| Артефакт     | Где                                                               |
| ------------ | ----------------------------------------------------------------- |
| Манифест     | `Build1.lst`, `Build1.ver` (репо / `data-from-used-live-client/`) |
| URL map AMF  | `Pub1/images/locale/ru/pack.cfg` (`quest_info=…?ux=…`)            |
| AS3 load     | `Main.as` pack.cfg + `QuestModelSetter` / `Links.AMF_QUESTS`      |
| Updater host | `static.jugger.ru`                                                |
| Game static  | `s1.jugger.ru/images/**` ← stub/server Pub1                       |
