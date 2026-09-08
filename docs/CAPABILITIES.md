# Возможности j-emu

Единственный продуктовый статус переноса. Архитектурные документы описывают
ограничения реализации, но не означают, что функция уже работает.

Статусы:

- **готово** — есть E2E и подтверждённый клиентский сценарий;
- **частично** — существует только часть старого сценария;
- **не перенесено** — рабочее поведение есть только в `jgr-emu`;
- **вне scope** — не входит в первую волну 1–8.

## Foundation — готово

- PostgreSQL + Drizzle и pre-baseline init migration;
- database-generated persistent IDs;
- versioned content drafts/releases/publication;
- typed static OA/fproxy/esrv dispatch;
- raw-AMF E2E через Fastify и отдельную test DB;
- active combat в RAM, finished history в PostgreSQL на 72 часа;
- lint, format, dead-code, architecture и build gates.

## Client и auth — готово

- HTTPS `s1.jugger.ru:443` с legacy CEF TLS;
- login, registration, dev slot и logout;
- `/game.php`, FlashVars, пять cookies в HTTP 200;
- root Pub1 client paths;
- реальный клиент открывает Flash shell и отправляет OA.

## Bootstrap и character — частично

Есть:

- numeric account/hero identity;
- persisted hero, skills, HP/MP/EXP, appearance и personal details;
- полный flat состав `common|init` и `common|init2` из jgr-emu baseline
  (без party restore, presence announce и fight resume);
- `user|skills`, magic, view, conf, unitframe, bag/pocket;
- authored `common|conf`, empty chrome и level/appearance catalog из active
  release;
- starter bag/pocket;
- area 503 и authored hunt rows;
- persisted tutorial completion flags;
- cold login, reconnect и process restart bootstrap (raw-AMF E2E).

Не перенесено:

- подтверждённый вход до полностью отрисованного HUD/локации в реальном клиенте;
- regeneration timestamps как живой ticker и ghost/injury state;
- equipment-derived view/stats (перчатка 9095 остаётся в bag).

## Inventory — частично

Есть catalog projection, stable item instance IDs, starter items и чтение bag.

Не перенесены PUT_ON, PUT_OFF, DROP, stack/capacity rules, stat recalculation,
durability и USE pipelines.

## World и hunt — частично

Есть published area/hunt content и минимальный `ATTACK_BOT`.

Не перенесены area transitions, travel time, presence, spawn movement/respawn,
hunt locks и полный realtime flow.

## Combat — частично

Есть минимальный hunt fight lifecycle, fproxy transport, terminal packets,
process-local active state и finished history.

Не перенесены полный legacy packet flow, pocket/glove/rage/aggro, loot,
HP/EXP/level settlement, reconnect и fight locks.

## Quests и NPC 1–8 — не перенесено

Board, dialogs, book, goals, scripts, AREA waiting, quest fights, rewards,
markers и curated chain пока существуют только в legacy corpus.

## После core — не перенесено

Chat/party, полный store, mail, auction и trade рассматриваются после цикла 1–8.

## Вне первой волны

Professions, dungeons, battlegrounds, achievements, daily quests, heroism,
gear spells, info pages и content editor.

Clan и встроенные playerbots не переносятся.

## Как менять статус

Статус повышается только вместе с:

1. адаптированным модульным контрактом;
2. raw-AMF/Fastify/PostgreSQL E2E;
3. проверкой persistence/reconnect, если она требуется сценарию;
4. успешным сценарием в реальном клиенте для статуса **готово**.

Источник старых возможностей:
[jgr-emu CAPABILITIES.md](../../jgr-emu/docs/CAPABILITIES.md).
