# Quests (QST-ENG-01)

Checkpoint до coding. Runtime board/dialog/progress ещё нет: bootstrap отдаёт
пустой `bookTrio`, USE 584 остаётся `203`. Product status:
[CAPABILITIES.md](../CAPABILITIES.md).

## Sources

- `jgr-emu/docs/QUESTS.md`, `QUEST_DIALOG.md`, `QUEST_BOARD_ICONS.md`,
  `NPC_CATALOG.md`, `ITEM_NPC_DIALOG.md`;
- `jgr-emu/docs/PROTOCOL.md` (плашка vs `npc|answer`), `ID_RANGES.md`;
- CMB-09 `FightTerminalObserver` / `purpose: "quest" | "hunt"`.

Known bugs в `TEMP_QUEST_ITEM_AND_MARKER_BUGS.md` не переносятся.
Куратский Акрилон (`q_1`…, NPC 1617/250) — `CONTENT-STORY-*`, не этот срез.

## Ownership

Отдельный ADR и блокирующий `ARC-QST` не нужны: награды и consume идут через
уже существующие ports в одной composition UoW.

| Owner       | Holds                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| `quests`    | authored NPC/quest/dialog/goal/script/flag (`release_id`) и player `hero_quests` / goals / facts / waiting |
| `catalog`   | artifacts, bots, store lots, reputation tracks; не NPC и не quest graph                                    |
| `world`     | areas и travel `area_links` (только `COME_IN`)                                                             |
| `character` | EXP/money/reputation/`setArea`/`learnProfession`                                                           |
| `inventory` | grant/consume/PUT_ON; USE `openDialog` не импортирует quests                                               |
| `combat`    | RAM fight; `startHunt({ purpose: "quest" })`; terminal notice                                              |
| `chat`      | `MSG` после commit                                                                                         |
| composition | `QuestDesk`: UoW, script effects, book piggyback, area_conf overlay, fight start after commit              |

`quests` не пишет `heroes`/`items` и не импортирует combat/world/inventory.
Script registry возвращает typed effects; `QuestDesk` исполняет их через
public ports. Nested `UnitOfWork.run` переиспользует ту же транзакцию.

## Content set

Три синтетических квеста в playable-slice (не DATA-06 corpus):

1. **Board** — NPC **271** (Голова мертвеца): talk → buy **23** → equip **23**
   → deliver. Вход: USE **584** (`openDialog`) и/или hotspot 503.
2. **Fight** — dialog `START_FIGHT` `mode:"quest"` vs bot **2**; kill/`win_fight`;
   `GRANT_ARTIKUL` **77**; loot-goal считает сумку, не hunt drop-cap.
3. **Area** — `area_action` на объекте 503 (item id ≠ 5 и ≠ 7):
   `common|waiting` → `action_finish` → `MSG` + `SET_FLAG`; бой с AREA —
   `QST-ENG-02`.

`book_id` / `point_id` authored с 1, не живые id из `quest_info.amf` и не 1617.
Click-ref hotspot ≠ catalog `info_id`, кроме self-ref NPC 271
([NPC_CATALOG.md](../../../jgr-emu/docs/NPC_CATALOG.md)). Невалидная ссылка
на area/bot/artikul/NPC/dialog отменяет весь candidate.

## Schema (план реализации)

JSONB у квестов нет. Authored и progress — колонки.

Authored (`release_id`, публикация): `npcs`, `npc_actions`, `npc_quests`,
`quests`, `quest_requires`, `quest_award_items`, `quest_goals`,
`quest_goal_artikuls`, `quest_goal_actions`, `quest_dialog_steps`,
`quest_script_ops`, `quest_script_fight_roster`, `world_facts`.

Player (identity с 1 там, где нужен surrogate): `hero_quests` (`status`
`active|done`, `dialog_step`, `dialog_cursor` text, waiting columns),
`hero_quest_goals` (`done` 0/1, `value`; нет строки = цель не на ветке;
сброс — UPSERT `value=0, done=0`, не DELETE), `hero_facts`.

Нет `hero_quests` = квест не взят. Visibility доски считается при чтении.
Waiting — колонки на `hero_quests`, не RAM и не DelayScheduler.

## Ports

`board(npcRef)`, `answer({ npcRef, pointId, answerId })`, `bookTrio(filterType)`,
`cancel(bookId)`, `recordSignal(QuestSignal)`, `beginAreaAction` /
`finishAreaAction`.

`QuestSignal`: `talk` / `kill` / `loot` / `buy` / `equip` / `deliver` /
`area_action` / `win_fight`. Composition шлёт buy после `StorePurchase`,
equip после PUT_ON, kill/`win_fight` из `FightTerminalObserver` (hunt и
`purpose:"quest"`), loot как sync сумки по authored artikul.

Prior-gate: бамп только текущей цели (`goal_ord` ниже `done`). Пустой
`quest_goals` — vacuously done. До 6 active. Repeat turn-in / повторный
answer после сдвига курсора не выдаёт награду.

## Scripts

Статический registry. Неизвестный `type` — fail publication и runtime `204`.

| Op                            | Кто исполняет                         | Этот срез                                      |
| ----------------------------- | ------------------------------------- | ---------------------------------------------- |
| `START_FIGHT`                 | composition после commit              | только из dialog `npc\|answer` + `fight\|conf` |
| `GRANT_ARTIKUL`               | inventory                             | да                                             |
| `GRANT_AWARDS`                | character/inventory/reputation        | turn-in                                        |
| `GRANT_PROFESSION`            | `learnProfession`                     | да                                             |
| `REMOVE_ARTIKUL`              | inventory; нет предмета — skip        | deliver consume                                |
| `MSG`                         | `ChatDesk.deliverSystem` после commit | да                                             |
| `SET_FLAG`/`CLEAR`            | `hero_facts`                          | да                                             |
| `BUMP_GOAL` / `COMPLETE_GOAL` | quests                                | да                                             |
| `JUMP_AREA`                   | —                                     | leftover                                       |
| AREA `START_FIGHT`            | —                                     | `QST-ENG-02`                                   |

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
  (`msg_text` плашка, не `npc|answer`). Нет waiting row — `203`.
- USE 584: не consume; piggyback `npc|info` + `npc|quests`.
- Fail: нет сессии `4`; запрещено `203` + `error`; внутренняя `204`.
  Не пустой `status:100` для неизвестного NPC/квеста.

`area_conf.items`: union travel (`COME_IN`) + NPC href + AREA href.
`world.linksFrom` не расширяется NPC-строками.

## Clock, ID, lock

Clock — request-time `Clock` (метки waiting/started). Бой не стартует из
таймера. RNG только явный `{ unit(): number }`. Authored id из контента;
player row id — PostgreSQL identity с 1. `answer_id=0` — исключение
[ID_POLICY.md](../architecture/ID_POLICY.md). Лок — строка героя в той же
UoW, что progress и награды. `START_FIGHT` — после commit (RAM, ADR-0020).
Join в `purpose:"quest"` по-прежнему `HuntJoinDenied`.

## Restart / CEF

Cursor, goals, facts, waiting и done переживают reconnect/restart.
Mid-fight RAM без `on_win`/`on_lose`. Concurrent turn-in — один award.
CEF: [CEF_MANUAL.md](../migration/CEF_MANUAL.md).

## Leftover

`QST-ENG-02`: AREA→quest-fight, map «!», quest-loot drop cap.
DATA-06 / `CONTENT-STORY-*`: Акрилон и полный NPC corpus.
Макросы `[[ARTIFACT]]` сверх dump-проверенного award_message — leftover.
Туториал, daily, `OPEN_STORE`, ambush `chance` без `mode:"quest"`.

Ручные файлы у лимита 400 строк (`composition-root`, `jugger-command-module`,
`parse-content-bundle`, `content-document`) перед регистрацией команд
извлекаются, а не растут.
