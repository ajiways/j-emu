# Quests (QST-ENG-01 / QST-ENG-02)

Runtime board/dialog/progress: NPC **271**, пять синтетических квестов
(включая `q_engine_daily` с `flags:1` и `q_engine_roster`), USE **584** открывает доску без
consume. QST-ENG-02 вешает AREA leftover
`START_FIGHT`, generic hunt loot-cap и честные book/area_conf маркеры.
Product status: [CAPABILITIES.md](../CAPABILITIES.md) (CEF ещё не вычеркнут).

## Sources

- `jgr-emu/docs/QUESTS.md`, `QUEST_DIALOG.md`, `QUEST_BOARD_ICONS.md`,
  `NPC_CATALOG.md`, `ITEM_NPC_DIALOG.md`, `QUEST_MAP_MARKERS.md`;
- `jgr-emu/docs/PROTOCOL.md` (плашка vs `npc|answer`), `ID_RANGES.md`;
- CMB-09 `FightTerminalObserver` / `purpose: "quest" | "hunt"`;
- QL-1 / QM-1 / QM-2 из `TEMP_QUEST_ITEM_AND_MARKER_BUGS.md` — контракт
  лимита и маркеров; workaround `mergeFinishedQuestsForMapMarkers` и QL-2
  не переносятся.

Known bugs сверх QL-1/QM-1/QM-2 в `TEMP_QUEST_ITEM_AND_MARKER_BUGS.md` не
переносятся.
Куратский Акрилон (`q_1`…, NPC 1617/250) — `CONTENT-STORY-*` после
`QST-ENG-03` и `CMB-10`, не этот срез.

## Ownership

Отдельный ADR и блокирующий `ARC-QST` не нужны: награды и consume идут через
уже существующие ports в одной composition UoW.

| Owner       | Holds                                                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quests`    | authored NPC/quest/dialog/goal/script/flag (`release_id`) и player `hero_quests` (включая `hidden_in_journal`) / goals / facts / waiting              |
| `catalog`   | artifacts, bots, store lots, reputation tracks; не NPC и не quest graph                                                                               |
| `world`     | areas и travel `area_links` (только `COME_IN`)                                                                                                        |
| `character` | EXP/money/reputation/`setArea`/`learnProfession`                                                                                                      |
| `inventory` | grant/consume/PUT_ON; USE `openDialog` не импортирует quests                                                                                          |
| `combat`    | RAM fight; `startHunt({ purpose: "quest" })`; terminal notice                                                                                         |
| `chat`      | `MSG` после commit                                                                                                                                    |
| composition | `QuestDesk`: UoW, script effects, book piggyback, area_conf overlay, fight start after commit; `HuntFightSettlement` клипает hunt drop через `needed` |

`quests` не пишет `heroes`/`items` и не импортирует combat/world/inventory.
Script registry возвращает typed effects; `QuestDesk` исполняет их через
public ports. Nested `UnitOfWork.run` переиспользует ту же транзакцию.

## Content set

Пять синтетических квестов в playable-slice (не DATA-06 corpus):

1. **Board** — NPC **271** (Голова мертвеца): talk → buy **23** → equip **23**
   → deliver. Вход: USE **584** (`openDialog`) и/или hotspot 503.
2. **Fight** — dialog `START_FIGHT` `mode:"quest"` vs bot **2**; kill/`win_fight`;
   `GRANT_ARTIKUL` **77**; loot-goal считает сумку; hunt drop того же artikul
   режется `needed` (QST-ENG-02).
3. **Area** — `area_action` на объекте 503 (item id ≠ 5 и ≠ 7):
   `common|waiting` → `action_finish` → leftover `START_FIGHT` `mode:"quest"`
   vs bot **2**; после победы MSG + `SET_FLAG`.
4. **Daily** — `q_engine_daily`, `flags:1`, talk → turn-in раз за круг.
5. **Roster** — `q_engine_roster`: talk → `win_fight`; START_FIGHT enemies
   **2**+**32**, ally **4**, `flags:"8"`, `chat_*`. CMB-10.

`book_id` / `point_id` authored с 1, не живые id из `quest_info.amf` и не 1617.
Click-ref hotspot ≠ catalog `info_id`, кроме self-ref NPC 271
([NPC_CATALOG.md](../../../jgr-emu/docs/NPC_CATALOG.md)). Невалидная ссылка
на area/bot/artikul/NPC/dialog отменяет весь candidate.

## Schema

JSONB у квестов нет. Authored и progress — колонки. Миграция `0021_quests_engine`.

Authored (`release_id`): `npcs`, `npc_quests`, `quests`, `quest_award_items`,
`quest_goals` (`object_id`), `quest_goal_artikuls`, `quest_dialog_steps`,
`quest_script_ops`, `quest_script_fight_roster`, `world_facts`.
`npc_actions` / `quest_requires` в этом срезе нет (level_min на строке квеста;
пустой `action_list`).

Player (identity с 1): `hero_quests` (`status` `active|done`, `dialog_step`,
`dialog_cursor` text, waiting columns, `hidden_in_journal` 0/1), `hero_quest_goals` (`done` 0/1,
`value`; нет строки = цель не на ветке; сброс — UPSERT `value=0, done=0`,
не DELETE), `hero_facts`.

Нет `hero_quests` = квест не взят. Visibility доски считается при чтении.
Waiting — колонки на `hero_quests`, не RAM и не DelayScheduler.

## Ports

`board(npcRef)`, `answer({ npcRef, pointId, answerId })`, `bookTrio(filterType)`,
`cancel(bookId)`, `hideJournal(bookId)`, `recordSignal(QuestSignal)`,
`beginAreaAction` / `finishAreaAction`, `needed(heroId, artikulId)`.

`QuestSignal`: `talk` / `kill` / `loot` / `buy` / `equip` / `deliver` /
`area_action` / `win_fight`. Composition шлёт buy после `StorePurchase`,
equip после PUT_ON, kill/`win_fight` из `FightTerminalObserver` (hunt и
`purpose:"quest"`), loot как sync сумки по authored artikul.

Prior-gate: бамп только текущей цели (`goal_ord` ниже `done`). Пустой
`quest_goals` — vacuously done. До 6 active. Repeat turn-in / повторный
answer после сдвига курсора не выдаёт награду.

## Scripts

Статический registry. Неизвестный `type` — fail publication и runtime `204`.

| Op                            | Кто исполняет                         | Этот срез                                                               |
| ----------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| `START_FIGHT`                 | composition после commit              | dialog `npc\|answer` и AREA `action_finish` + `fight\|conf`             |
| `GRANT_ARTIKUL`               | inventory                             | да; clip через `needed`, если текущая loot/deliver цель на этот artikul |
| `GRANT_AWARDS`                | character/inventory/reputation        | turn-in; `awardRep` → `grantReputation`                                 |
| `GRANT_PROFESSION`            | `learnProfession`                     | да                                                                      |
| `REMOVE_ARTIKUL`              | inventory `consumeByArtikul`          | bag, иначе paperdoll; нет экземпляра — skip                             |
| `MSG`                         | `ChatDesk.deliverSystem` после commit | да                                                                      |
| `SET_FLAG`/`CLEAR`            | `hero_facts`                          | да                                                                      |
| `BUMP_GOAL` / `COMPLETE_GOAL` | quests                                | да                                                                      |
| `JUMP_AREA`                   | jugger-wire `npc\|answer`             | leftover `{ jump:"area", macros_list:[] }`, не `setArea`                |

ORATORY: `{ unit(): number }`, `unit()*100 < probability`; без `probability` —
успех. Синтетика без броска. Формула от стата — leftover.

## Wire

- `npc|info` + `npc|quests` — nested доска; `answer_id=0` открывает point.
  Иконки: `flags` × `point_flags` ([QUEST_BOARD_ICONS.md](../../../jgr-emu/docs/QUEST_BOARD_ICONS.md)).
- `npc|answer` — курсор; `to_fight:1` / `probability` на кнопке; ритуал —
  тот же ответ, что `fight|conf`.
- `book|quest_list` / `quest_targets` / `quest_counters` — trio, не один
  list. Piggyback: init/init2, answer/accept/turn-in, dirty buy/PUT_ON,
  fight finish, wrong `area_action`.
- `book|quest_cancel` + `state`. `book|quest_delete` `form.quest_id`=bookId,
  без `state` (DAY-01).
- AREA: `common|action` 100 + `common|waiting` → клиент → `action_finish`
  (`msg_text` плашка, не `npc|answer`). Нет waiting row — `203`. Если
  leftover `START_FIGHT` — piggyback `fight|conf` на тот же ответ
  (бой на `action_finish`, не на клик).
- USE 584: не consume; piggyback `npc|info` + `npc|quests`.
- Fail: нет сессии `4`; запрещено `203` + `error`; внутренняя `204`.
  Не пустой `status:100` для неизвестного NPC/квеста. Ghost / `hp < 1` →
  `203` «нельзя атаковать». Уже в бою — существующий combat deny.

`area_conf.items`: union travel (`COME_IN`) + NPC href + AREA href.
`world.linksFrom` не расширяется NPC-строками. Hunt-бот (kill/loot artikul)
не получает offer href `npc|quests` (QM-2).

## AREA `START_FIGHT` (QST-ENG-02)

Бой стартует на `action_finish`, не на клике AREA. `START_FIGHT`
`mode:"quest"` ≠ засада.

Если onFinish текущей `area_action` содержит `START_FIGHT` `mode:"quest"`:

1. `finishAreaAction` сбрасывает waiting и **не** бампает цель
   (`progress_on_win` по умолчанию; колонки нет).
2. После commit `QuestDesk` вызывает тот же `startQuestFight`, что dialog.
3. `win_fight` signal эту `area_action` не закрывает (другой kind / prior-gate).
4. `FightTerminalObserver` на победе `purpose:"quest"`: если текущая цель
   всё ещё эта `area_action` — bump, затем onFinish без `START_FIGHT`
   (MSG / SET_FLAG).
5. Проигрыш: цель incomplete; waiting уже сброшен; повторный клик AREA
   снова ставит waiting. Mid-fight RAM без `on_win`/`on_lose`.

`START_FIGHT` не кладут в onFinish **после** bump — это anti-pattern
legacy. Засада `chance` без `mode:"quest"` — QST-ENG-04. `progress_on_win:false`
на `mode:"quest"` AREA — leftover.

## QST-ENG-04 — deny leave / ambush / QL-2

Контракт для coding. Product-status не менять здесь. Очередь:
[ROADMAP.md](../migration/ROADMAP.md) QST-ENG-04 (`next`).

### Deny leave

jgr `handleLeaveFight`: `questFight || instanceCopyId > 0` →
`{rs:false, err:"нельзя выйти из боя", sq}`, без flee. Сейчас j-emu
`leaveFight` всегда flees; quest piggyback не ставит `can_leave:0`
(только `flags:"8"`); dungeon overlay `can_leave:0` уже есть, сервер всё
равно пускает leave.

Combat: deny, если `purpose === "quest"` **или** `instanceCopyId !== null`.
Friendly/outdoor hunt — прежний flee. Dump fproxy, не OA 203. Quest
`fight|conf` overlay `can_leave:0`. Join в `purpose:"quest"` по-прежнему
`HuntJoinDenied`.

### Ambush `chance`

`START_FIGHT` без `mode:"quest"`: один `artikulId`, optional `chance` 0..1.
Нет `chance` = всегда (именованное правило, как jgr omit). Поле есть и не
в [0,1] — ошибка публикации/runtime, не clamp. `mode:"quest"` и ambush не
смешивать в одном op. Chance на quest-mode — не этот срез.

AREA: `hasQuestStartFight` только ops с `mode:"quest"`. Ambush **не**
паркует bump: `action_finish` считает клик сразу, исход боя цель не двигает.
Бой — `startHunt` `purpose:"hunt"` (обычный PvE, join/leave как охота), не
flags 8. RNG `{ unit(): number }`; старт если `unit() < chance`. Miss —
`action_finish` 100 без `fight|conf`.

Content: `q_engine_ambush` на NPC 271, 503 item **1** (свободен), бот **2**,
e2e `chance` 1 или omit. Не `q_1`.

### QL-2

После DROP/SELL (тот же `BagDropCommand`) composition зовёт quests-port:
для каждой **текущей** loot/deliver цели на этот artikul
`value = min(limit, bagCount)`, `done` только при `bagCount >= limit`.
Тот же порт после USE consume и script `REMOVE_ARTIKUL`. Inventory quests
не импортирует. Несколько текущих целей на один artikul — общий счётчик
сумки, каждая цель независимо (как `needed` clip).

`q_engine_fight` `loot_meat` artikul **77**. `consume_at=goal_complete` в
j-emu нет — leftover. Сдача по-прежнему проверяет сумку, не только `done`.

### Fail-fast / restart / CEF

Невалидный ambush schema — candidate fail. leave deny не маскировать
`rs:true`. QL-2 без sync после DROP — дыра, не «done остаётся».

Deny leave RAM (ADR-0020). QL-2 bag+goals PostgreSQL. Ambush mid-fight RAM.
Product **частично** до CEF. Строка CEF_MANUAL — на close coding.

### Out of this slice

`progress_on_win:false`; `on_lose` reset цели; `OPEN_STORE` (QST-ENG-05);
`consume_at`; chance на `mode:"quest"`; Акрилон.

## Loot-cap (QL-1)

Перед `grantToBag` hunt-дропа composition спрашивает quests
`needed(heroId, artikulId)`:

- нет текущей loot/deliver цели на этот artikul → `null` (дроп как CMB-07);
- иначе `needed = max(0, limit - bagCount)`; несколько таких текущих целей —
  `min` по целям (не «один artikul глобально»);
- `grant = min(candidate, needed)`; атомарно на loot resolution этого боя;
- чат «Вами получено» и `fight|loot` — фактически выданное.

Combat таблицу квестового лута не читает. Party-bag defer — leftover
(срез соло). QL-2 — QST-ENG-04.

`GRANT_ARTIKUL` из скрипта режется тем же `needed`, только пока текущая
цель loot/deliver на этот artikul; после bump цели authored count идёт
как награда.

## Markers

Клиентский мигающий «!» у NPC считается из Pub1 `quest_info.amf` +
`finished_quests_id`, не из `area_conf.items`. j-emu отдаёт **честные**
book_id сдачи. `mergeFinishedQuestsForMapMarkers` (ложь в finished +
чтение Pub1) не переносится. Ложный «!» Акрилона — CONTENT-STORY +
совпадающие live `book_id` / [PUB1_UPDATE.md](../../../jgr-emu/docs/PUB1_UPDATE.md).

Generic в этом срезе:

- QM-1: `book|quest_targets` / `quest_counters` только `currentGoal`;
  скрыты, когда цель `done` или не на ветке;
- QM-2: offer в `area_conf` только из реальной NPC-доски и AREA hotspot,
  не из kill/loot bot artikul. Не копировать `mapOfferMarkers.ts`.

## Clock, ID, lock

Clock — request-time `Clock` (метки waiting/started). Бой не стартует из
таймера. RNG только явный `{ unit(): number }` (hunt roll, ambush `chance`);
loot-cap детерминированный clip после ролла. Authored id из контента;
player row id — PostgreSQL identity с 1. `answer_id=0` — исключение
[ID_POLICY.md](../architecture/ID_POLICY.md). Лок — строка героя в той же
UoW, что progress, награды и `needed`. `START_FIGHT` — после commit
(RAM, ADR-0020), и с dialog, и с AREA. Join в `purpose:"quest"` по-прежнему
`HuntJoinDenied`.

## Restart / CEF

Cursor, goals, facts, waiting и done переживают reconnect/restart.
Mid-fight RAM без `on_win`/`on_lose`. Concurrent turn-in — один award.
CEF: [CEF_MANUAL.md](../migration/CEF_MANUAL.md).

## DAY-01 — Daily quests

Срез закрыт (raw-AMF `q_engine_daily`). CEF не прогонялся. Product
**частично**: [CAPABILITIES.md](../CAPABILITIES.md). Workflow `done`:
[ROADMAP.md](../migration/ROADMAP.md) DAY-01.

`flags & 1` = daily. Журнал `multitime:1`. Сданная ежедневка **не** в
`finished_quests_id`. Скрыть строку — OA `book|quest_delete`
`form.quest_id` = `bookId`, колонка `hero_quests.hidden_in_journal`, не
`quest_cancel`.

Cooldown: `ftime` = unix `finished_at`; `cooldown` =
`nextMoscow6am(ftime) - ftime`. Active: `ftime:0` `cooldown:0`. Запрещена
пара `ftime:0` + `cooldown:86400`. Часовой пояс — именованный
`DailyCycleRules` UTC+3 / 06:00, `Clock.unixSeconds()`.

Wipe 06:00 — lazy в quests UoW на board/book/answer/cancel/delete: DELETE
daily `hero_quests`+goals, если `startedAt` (active) или `finishedAt`
(done) `< lastMoscow6am(now)`. Включая незакрытый прогресс. `DelayScheduler`
и `Clock.schedule` не используются. Catch-up после downtime — следующий OA.

`accept` не поднимает `done`→`active`. `GRANT_AWARDS` EXP для daily:
`quest:{heroId}:{key}:exp:{lastMoscow6am(finishedAt)}`.

Content: `q_engine_daily` на NPC 271, `flags:1`, talk → `GRANT_AWARDS`.
Slice bump. Validator: ровно один `flags & 1`.

Иконки доски: `flags:1` × pf 8/`0` = `start_m` / `pnt_m`
([QUEST_BOARD_ICONS.md](../../../jgr-emu/docs/QUEST_BOARD_ICONS.md)).

### Out of this slice

Данж `256`/`257`, MAIN `33`, live 75/276, `daily_pvp_kills` / stats object
49, `mergeFinishedQuestsForMapMarkers`, esrv push ровно в 06:00 без OA.

## Leftover

DATA-06 / `CONTENT-STORY-*`: Акрилон после QST-ENG-03, полный NPC
corpus, live `book_id` для честного клиентского «!».
Макросы `[[ARTIFACT]]` сверх dump-проверенного award_message — leftover.
Туториал, `OPEN_STORE`, `progress_on_win:false`,
`consume_at=goal_complete`, `on_lose` reset всей цели сверх текущего incomplete.
Deny leave / ambush / QL-2 — QST-ENG-04.

## QST-ENG-03 — Multi-board / JUMP_AREA / awards.rep

Workflow `done`. Product **частично** до CEF:
[CAPABILITIES.md](../CAPABILITIES.md), [CEF_MANUAL.md](../migration/CEF_MANUAL.md).

### Content

`playable-slice/v32`, file seed. Не `q_1`, не book 90002, не NPC 1617/2024.

| Сущность         | Значение                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| NPC 271          | 503 / `itemId` **4**; USE **584** без изменения                                                                                  |
| NPC 272          | `id`/`infoId` **272**, 503 / `itemId` **8**; dump-proven picture                                                                 |
| 503 item **1**   | свободен                                                                                                                         |
| `q_engine_multi` | `bookId` **6**, `flags` **32**, `awardExp` **6**                                                                                 |
| `awardRep`       | `{ objectId:5, amount:10, cap:0 }`                                                                                               |
| boards           | 271 `pointId` **6** `boardOrd` **6** `active_only:false`; 272 `pointId` **7** `boardOrd` **1** `active_only:true` + свой welcome |
| `onAccept`       | `JUMP_AREA` + `GRANT_ARTIKUL` 23×1                                                                                               |
| goals            | `talk` `objectId` **272**; `win_fight` bot **2**×1, `onFinish` `REMOVE_ARTIKUL` 23 + MSG                                         |

Talk-цели `q_engine_board` / `q_engine_daily` / `q_engine_fight` /
`q_engine_roster` — `objectId` **271**. Хоты 271/272 не занимают items 1, 3,
5, 7.

### Schema / lookup

Authored JSON (camelCase, как `onFinish` / `dialogSteps`):

- optional `scripts.onAccept: QuestScriptOp[]` — один раз при insert accept;
- optional `awardRep: { objectId, amount, cap }` — нет поля = нет гранта репы;
- optional `boards: [{ npcId, boardOrd, pointId, activeOnly, welcomeMessage }]`
  — **дополнительные** NPC-link. Primary остаётся `npcId` / `pointId` /
  `boardOrd` / `welcome*` на квесте.

`npc_quests`: колонки `active_only` (boolean, not null) и
`welcome_message` (text, not null). PK `(release, npc, quest)` уже есть.
`point_id` уникален в релизе среди `quests.point_id` **и** board-link.
`npc\|quests` / `npc\|answer` резолвят квест по `(npcId, pointId)` link, не
только по `quests.point_id`. `JUMP_AREA` — валидный script op. `awardRep`
на неизвестный track — ошибка публикации.

Один линейный курсор на квест (не вторая state-machine). Secondary
`active_only` — та же сцена, другая доска.

### Правила

- Доска 272 не показывается без active `q_engine_multi` и когда
  `currentGoal.objectId !== 272`. 271 в mid видна (`flags:32`, pf `0`).
- Offer 271: `flags:32` pf `8` (`main_start`). Secondary visible: `32`+`0`
  (`main_pnt`). Борд `award_rep` остаётся `""` (live).
- `QuestSignal` talk несёт `npcId`. Match: `kind===talk` и
  `goal.objectId === npcId`. Talk `objectId` 0 — ошибка публикации.
- Accept с leftover `JUMP_AREA`: `npc\|answer`
  `{ status:100, jump:"area", macros_list:[] }` **вместо** dialog payload.
  `heroes.area` / `setArea` не вызывать. После `fight\|finish` `JUMP_AREA`
  локацию не меняет и `npc\|answer` не шлёт.
- `GRANT_AWARDS` как сейчас выдаёт exp/money/items из документа, плюс
  `grantReputation({ objectId, amount, cap })` из `awardRep`. Cap 0 = без
  капа источника. Чат репы — leftover SOC-01. Отдельный `GRANT_REP` op не
  добавлять.
- `REMOVE_ARTIKUL`: public `consumeByArtikul` — bag, иначе paperdoll
  (в т.ч. `cnt=0`); нет экземпляра — skip. `allowPaperdoll` только когда
  active fight уже снят с RAM (`afterFinished` после `byAccount.delete`).
  `fight\|finish` отдаёт `user\|view.artifacts`. Чата «Изъято» нет.

### Fail-fast / restart / CEF

Публикация падает: неизвестный script; два NPC на одном `(areaId,itemId)`;
hotspot vs travel; talk без NPC; `awardRep` на неизвестный / SUM 36 track;
271 или 272 на item 1. Runtime 204 на неизвестный op. JUMP не fallback-телепорт.

Персистятся cursor, goals, `hero_reputations`, bag/paperdoll. Jump — только
wire этого ответа.

CEF leftover: USE 584 → MAIN доска 271 → accept → клиент закрывает NPC
(`jump`). Хотспот 272 в `forestvillage.swf` не доказан — e2e `ref=272`.
CEF-PASS не ставить.

## CONTENT-STORY-01

Очередь: [ROADMAP.md](../migration/ROADMAP.md) (`queued`). Не стартовать,
пока leftover-движки (QST-ENG-04 / OPEN_STORE / …) не `done`.
Контракт q_1 там. Канон ритуала: enemies **85**×1 + **83**×7, не
fixture-only 83×7. 503 item **1** свободен после QST-ENG-03.

Ручные файлы у лимита 400 строк (`composition-root`, `jugger-command-module`,
`parse-content-bundle`, `content-document`) перед регистрацией команд
извлекаются, а не растут.
