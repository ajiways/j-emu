# Quests (QST-ENG-01 / QST-ENG-02)

Runtime board/dialog/progress: NPC **271**, три синтетических квеста,
USE **584** открывает доску без consume. QST-ENG-02 вешает AREA leftover
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
Куратский Акрилон (`q_1`…, NPC 1617/250) — `CONTENT-STORY-*`, не этот срез.

## Ownership

Отдельный ADR и блокирующий `ARC-QST` не нужны: награды и consume идут через
уже существующие ports в одной composition UoW.

| Owner       | Holds                                                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quests`    | authored NPC/quest/dialog/goal/script/flag (`release_id`) и player `hero_quests` / goals / facts / waiting                                            |
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

Три синтетических квеста в playable-slice (не DATA-06 corpus):

1. **Board** — NPC **271** (Голова мертвеца): talk → buy **23** → equip **23**
   → deliver. Вход: USE **584** (`openDialog`) и/или hotspot 503.
2. **Fight** — dialog `START_FIGHT` `mode:"quest"` vs bot **2**; kill/`win_fight`;
   `GRANT_ARTIKUL` **77**; loot-goal считает сумку; hunt drop того же artikul
   режется `needed` (QST-ENG-02).
3. **Area** — `area_action` на объекте 503 (item id ≠ 5 и ≠ 7):
   `common|waiting` → `action_finish`. Coding вешает `START_FIGHT`
   `mode:"quest"` vs bot **2** на onFinish этой цели (тот же key, не
   четвёртый квест). Без `START_FIGHT` путь QST-ENG-01 (`MSG` + `SET_FLAG`)
   остаётся.

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
`dialog_cursor` text, waiting columns), `hero_quest_goals` (`done` 0/1,
`value`; нет строки = цель не на ветке; сброс — UPSERT `value=0, done=0`,
не DELETE), `hero_facts`.

Нет `hero_quests` = квест не взят. Visibility доски считается при чтении.
Waiting — колонки на `hero_quests`, не RAM и не DelayScheduler.

## Ports

`board(npcRef)`, `answer({ npcRef, pointId, answerId })`, `bookTrio(filterType)`,
`cancel(bookId)`, `recordSignal(QuestSignal)`, `beginAreaAction` /
`finishAreaAction`, `needed(heroId, artikulId)`.

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
| `GRANT_AWARDS`                | character/inventory/reputation        | turn-in                                                                 |
| `GRANT_PROFESSION`            | `learnProfession`                     | да                                                                      |
| `REMOVE_ARTIKUL`              | inventory; нет предмета — skip        | deliver consume                                                         |
| `MSG`                         | `ChatDesk.deliverSystem` после commit | да                                                                      |
| `SET_FLAG`/`CLEAR`            | `hero_facts`                          | да                                                                      |
| `BUMP_GOAL` / `COMPLETE_GOAL` | quests                                | да                                                                      |
| `JUMP_AREA`                   | —                                     | leftover                                                                |

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
- `book|quest_cancel` + `state`. `quest_delete` — DAY-01.
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
legacy. Засада `chance` без `mode:"quest"` и `progress_on_win:false` —
leftover.

## Loot-cap (QL-1)

Перед `grantToBag` hunt-дропа composition спрашивает quests
`needed(heroId, artikulId)`:

- нет текущей loot/deliver цели на этот artikul → `null` (дроп как CMB-07);
- иначе `needed = max(0, limit - bagCount)`; несколько таких текущих целей —
  `min` по целям (не «один artikul глобально»);
- `grant = min(candidate, needed)`; атомарно на loot resolution этого боя;
- чат «Вами получено» и `fight|loot` — фактически выданное.

Combat таблицу квестового лута не читает. Party-bag defer — leftover
(срез соло). QL-2 (DROP откатывает loot/deliver done) — leftover.

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
таймера. RNG только явный `{ unit(): number }` в hunt roll; loot-cap
детерминированный clip после ролла. Authored id из контента;
player row id — PostgreSQL identity с 1. `answer_id=0` — исключение
[ID_POLICY.md](../architecture/ID_POLICY.md). Лок — строка героя в той же
UoW, что progress, награды и `needed`. `START_FIGHT` — после commit
(RAM, ADR-0020), и с dialog, и с AREA. Join в `purpose:"quest"` по-прежнему
`HuntJoinDenied`.

## Restart / CEF

Cursor, goals, facts, waiting и done переживают reconnect/restart.
Mid-fight RAM без `on_win`/`on_lose`. Concurrent turn-in — один award.
CEF: [CEF_MANUAL.md](../migration/CEF_MANUAL.md).

## Leftover

DATA-06 / `CONTENT-STORY-*`: Акрилон, полный NPC corpus, live `book_id` для
честного клиентского «!».
Макросы `[[ARTIFACT]]` сверх dump-проверенного award_message — leftover.
Туториал, daily, `OPEN_STORE`, ambush `chance` без `mode:"quest"`,
`progress_on_win:false`, QL-2, roster `flags:"8"` / bot↔bot / deny leave,
`JUMP_AREA`, `on_win`/`on_lose` скрипты сверх существующего win_fight GRANT.

Ручные файлы у лимита 400 строк (`composition-root`, `jugger-command-module`,
`parse-content-bundle`, `content-document`) перед регистрацией команд
извлекаются, а не растут.
