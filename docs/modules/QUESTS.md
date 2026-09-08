# Quests и NPC 1–8

## Статус

Quest/NPC runtime и curated chain ещё не перенесены.

## Источники поведения

- `jgr-emu/docs/QUESTS.md`;
- `jgr-emu/docs/QUEST_DIALOG.md`;
- `jgr-emu/docs/NPC_CATALOG.md`;
- `jgr-emu/docs/QUEST_MACROS_CHAT.md`;
- `jgr-emu/docs/QUEST_BOARD_ICONS.md`;
- `jgr-emu/docs/QUEST_MAP_MARKERS.md`;
- `jgr-emu/src/quests/`, dialogs, NPC catalogs и
  `fixtures/quests_curated/`.

`TEMP_QUEST_ITEM_AND_MARKER_BUGS.md` описывает известные дефекты, а не
переносимое рабочее поведение.

## Content model

NPC, dialogs, quests, steps, goals и scripts импортируются как typed versioned
content. Runtime читает только active release.

Importer обязан проверить:

- уникальность IDs/keys;
- dialog/NPC/quest/area/item/bot references;
- достижимость steps и допустимые transitions;
- script operation и обязательные arguments;
- rewards/gates и зависимости store/reputation;
- полную curated chain 1–8.

Невалидная запись отменяет candidate. Handler не читает legacy JSON и не
подставляет отсутствующий NPC, item, area или bot.

## Runtime model

Persistent player quest state включает active step, goal progress, flags,
waiting state и полученные/сданные rewards. Content definition не копируется в
player row.

Core surfaces:

- NPC board и offer/remind/finish markers;
- dialog answers и cursor;
- quest book/cancel;
- kill, loot, buy, equip, deliver, talk и area_action goals;
- scripts `START_FIGHT`, grants/removals, messages и flags;
- system chat notifications;
- map/target markers.

AREA quest fight запускается после waiting. Progress bump выполняется после
подтверждённой победы; loss применяет явный `reset_on_lose`. Ambush без
`mode:"quest"` не меняет quest progress. Последний step gate проверяется на
`on_step`, если это задано legacy contract.

## Transactions

Quest transition, inventory consume/grant, rewards и flags изменяются одной
orchestration transaction через public ports владельцев. Chat/esrv notification
публикуется только после commit.

Повтор команды не должен повторно выдать reward или consume item.

## Порядок переноса

1. NPC catalog и board/dialog wire.
2. Quest definitions и player progress schema.
3. Базовые goal types и scripts.
4. Inventory/world/combat integration.
5. Curated chain по одному завершённому quest capability.
6. Markers и system messages.

## Acceptance

- чистый герой проходит утверждённую цепочку 1–8;
- restart сохраняет cursor/progress/waiting;
- concurrent/repeated turn-in не дублирует reward;
- loss/win quest fight меняют progress только по контракту;
- отсутствующая content reference блокирует publication;
- UI markers, dialogs и book совпадают с legacy client behavior.
