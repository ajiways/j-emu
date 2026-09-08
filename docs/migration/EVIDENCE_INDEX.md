# Источники переноса

Карта чтения `jgr-emu` для текущих срезов. Она указывает, откуда переносить
рабочее поведение; архитектурные решения принимает `j-emu`.

Общие источники:

- [legacy product inventory](../../../jgr-emu/docs/CAPABILITIES.md);
- [wire protocol](../../../jgr-emu/docs/PROTOCOL.md);
- [legacy request flow](../../../jgr-emu/docs/ARCHITECTURE.md);
- [короткий protocol research](../../../_research/02_protocol.md).

## Client, auth и bootstrap

- [REDIRECT.md](../../../jgr-emu/docs/REDIRECT.md) — hosts, certificate trust,
  HTTPS `:443`;
- [FILES.md](../../../jgr-emu/docs/FILES.md) — Pub1/certs layout;
- `jgr-emu/src/routes/auth.ts` и `src/views/` — полный browser/session flow;
- `jgr-emu/src/bootstrap.ts`, `heroBuilder.ts`, `gameConfig.ts` — состав
  init/init2;
- [CHARACTER_STATS.md](../../../jgr-emu/docs/CHARACTER_STATS.md) — starter state,
  skills и formulas;
- [HP_REGEN.md](../../../jgr-emu/docs/HP_REGEN.md) — hp/mp time;
- [ID_RANGES.md](../../../jgr-emu/docs/ID_RANGES.md) — client ID collisions.

Не переносить legacy env defaults, playerbot bootstrap и runtime `.bin`
fallback.

## Inventory

- [INVENTORY_USE.md](../../../jgr-emu/docs/INVENTORY_USE.md);
- [TRAVEL_BAG.md](../../../jgr-emu/docs/TRAVEL_BAG.md);
- [POCKET.md](../../../jgr-emu/docs/POCKET.md);
- [GLOVE_MAGIC.md](../../../jgr-emu/docs/GLOVE_MAGIC.md);
- [ITEM_NPC_DIALOG.md](../../../jgr-emu/docs/ITEM_NPC_DIALOG.md);
- `jgr-emu/src/items.ts`, `bagSlots.ts`, `bonuses.ts`, `stats.ts`;
- Pub1 artifact AMF и item overlays как content inputs.

Переносить wire fields, mutation order и business rules. Не переносить
dual-write редактора и runtime-чтение fixture JSON.

## World, hunt и realtime

- [AREA_SIDEBAR.md](../../../jgr-emu/docs/AREA_SIDEBAR.md);
- [SYNC.md](../../../jgr-emu/docs/SYNC.md);
- world-часть [TRAVEL_BAG.md](../../../jgr-emu/docs/TRAVEL_BAG.md);
- [BESTIARY.md](../../../jgr-emu/docs/BESTIARY.md);
- `jgr-emu/src/huntWorld.ts`, `huntSpawns.ts`, `huntWander.ts`,
  `areaActions.ts`, `routes/esrv.ts`;
- `radvei_areas.json` и `hunt_spawns.json` как authored inputs.

Playerbot presence и bot-generated market/world state исключаются.

## Combat

Сначала обязательный wire/lifecycle:

- [FIGHT_MODEL.md](../../../jgr-emu/docs/FIGHT_MODEL.md);
- [FIGHT_CAST_ACK.md](../../../jgr-emu/docs/FIGHT_CAST_ACK.md);
- [FIGHT_LOOT.md](../../../jgr-emu/docs/FIGHT_LOOT.md);
- [FIGHT_RECONNECT.md](../../../jgr-emu/docs/FIGHT_RECONNECT.md);
- [FIGHT_TOASTS.md](../../../jgr-emu/docs/FIGHT_TOASTS.md).

Затем механики:

- [FIGHT_TURN_UI.md](../../../jgr-emu/docs/FIGHT_TURN_UI.md);
- [FIGHT_RAGE.md](../../../jgr-emu/docs/FIGHT_RAGE.md);
- [FIGHT_JOIN.md](../../../jgr-emu/docs/FIGHT_JOIN.md);
- [FIGHT_LOCK.md](../../../jgr-emu/docs/FIGHT_LOCK.md);
- [POCKET.md](../../../jgr-emu/docs/POCKET.md);
- [GLOVE_MAGIC.md](../../../jgr-emu/docs/GLOVE_MAGIC.md);
- [BOT_SPELLS.md](../../../jgr-emu/docs/BOT_SPELLS.md).

[FIGHT_DAMAGE.md](../../../jgr-emu/docs/FIGHT_DAMAGE.md) и
[FIGHT_MAGIC.md](../../../jgr-emu/docs/FIGHT_MAGIC.md) содержат empirical или
invented formulas. Их можно сохранить как legacy behavior, но не как live
parity.

## Quests и NPC 1–8

- [QUESTS.md](../../../jgr-emu/docs/QUESTS.md);
- [QUEST_DIALOG.md](../../../jgr-emu/docs/QUEST_DIALOG.md);
- [NPC_CATALOG.md](../../../jgr-emu/docs/NPC_CATALOG.md);
- [QUEST_MACROS_CHAT.md](../../../jgr-emu/docs/QUEST_MACROS_CHAT.md);
- [QUEST_BOARD_ICONS.md](../../../jgr-emu/docs/QUEST_BOARD_ICONS.md);
- [QUEST_MAP_MARKERS.md](../../../jgr-emu/docs/QUEST_MAP_MARKERS.md);
- [QUEST_CURATOR_PROMPT.md](../../../jgr-emu/docs/QUEST_CURATOR_PROMPT.md);
- `jgr-emu/src/quests/`, `fixtures/quests_curated/`, dialogs и NPC catalogs.

Открытые пункты
[TEMP_QUEST_ITEM_AND_MARKER_BUGS.md](../../../jgr-emu/docs/TEMP_QUEST_ITEM_AND_MARKER_BUGS.md)
не считаются рабочим baseline: при переносе они становятся tests/tasks либо
удаляются как нерелевантные новой модели.

## Зависимости core

- [STORE.md](../../../jgr-emu/docs/STORE.md) — только магазины, необходимые
  квестам 1–8;
- [REPUTATION.md](../../../jgr-emu/docs/REPUTATION.md) — только quest
  rewards/gates;
- [CHAT.md](../../../jgr-emu/docs/CHAT.md) — только обязательные system
  notifications.

## Отложенные источники

Не адаптировать до отдельного решения: `PARTY`, `MAIL`, `AUCTION`, `TRADE`,
`DUNGEON`, `BATTLEGROUNDS`, professions, achievements, daily quests, heroism,
gear spells, info pages и editor docs.

`PLAYERBOT*`, generated playerbot catalogs и clan behavior исключены полностью.

## Правило продвижения факта

Факт из legacy документа становится каноном `j-emu`, только когда он:

1. включён в текущий scope;
2. не противоречит более сильному evidence;
3. записан в соответствующем `docs/modules/*`;
4. покрыт acceptance test или явно помечен как ещё не реализованный.
