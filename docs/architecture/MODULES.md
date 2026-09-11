# Модули

Документ описывает ownership target. Реализованы `identity`, `character`,
`inventory`, `catalog`, `world`, `combat`, `content`, `mail`, `auction`,
`trade`, `chat`, `party`, `instance`, `battleground`, `professions`,
`quests` и `jugger-wire`, но их полный target API ещё не перенесён. `social` и `economy` ниже являются
планом, а не возможностями runtime.
Фактический статус находится в [CAPABILITIES.md](../CAPABILITIES.md).

## Текущий runtime checkpoint

Текущий проверенный срез после готовых bootstrap, equipment
`PUT_ON`/`PUT_OFF`, bag DROP, pocket layout, world USE, area transitions и
area presence roster:

- `character` хранит hero scalars, personal details, naked `hero_skills`,
  `hero_reputations` (Радвей 5), `hp_time`, `regen_at`, `ghost` / `injury_time`
  / `injury_artikul_id`, `hero_bot_kills` (BOOK-01), `hero_professions` (PRF-01); internal ports `grantExperience`, `syncResources`,
  `noteHp`, `noteDefeat`, `resurrect`, `creditMoney`, `debitMoney`,
  `grantReputation` и `grantHonor` пишут этот state; `move_ready_at` и `setArea` на том же
  aggregate;
- `inventory` хранит bag/pocket/equipment instances, durability и выполняет
  `PUT_ON`/`PUT_OFF` (paperdoll и пояс), `drop`, `useFromBag`, `bagLoad`,
  `grantToBag`, `listPocket`, `applyDeathDurability` и `repair`;
- `catalog` и `world` читают artifacts, skills, levels, appearance,
  game-wide bootstrap documents, areas 503/501/504/542, travel `area_links`, hunt
  503 и витрину 504 (`store_types` type `-131`, lots 23/24), reputation track
  5 и professions 2/6 из active release;
- equipment-derived skills/vitals считаются из persisted naked skills и
  artifact bonuses; `0000_foundation_init` держит wear/occupancy, bag economy,
  pocket unique, artifact_actions, move_ready_at, area_links, ghost/injury,
  store types/lots, reputation tracks и durability;
- `combat` — hunt lifecycle, CMB-02…04 reconnect/ghost settlement и finished
  history;
- `mail` — `mail.letters` / `mail.letter_attachments`, welcome «Почтальон»,
  send/pick/COD/retract и TTL sweep. Target `social` mailbox ещё план.
- `auction` — `auction.listings` лоты и заказы, bid/buyout/cancel/fill и TTL
  sweep через mail settlement. Target `economy` listings ещё план.
- `trade` — process-local P2P сессия (инвайт, стол, confirm_key), settle в
  composition UoW. Target `economy` trade ещё план.
- `chat` — process-local area/private/system/party fan-out через esrv outbox,
  без таблиц. Target `social` channels ещё план.
- `party` — `party.parties` / `party_members` / `party_invites` /
  `party_bag_items`. Target `social` groups ещё план.
- `instance` — `instance.copies` / `binds` / `killed_spawns`, dungeon hunt
  RAM overlay, COME_IN ogre/kopi/tomb/usadba, `copy_type` `dungeon|bg`,
  `book|instances` read model. Clear/loot bands — leftover.
- `battleground` — RAM queue/invite/ban/live score, typed
  `battleground.finished_*`, Раскоп `general|2` (rooms 635/636/637, return
  500), HERO-01 match honor sum. POST-04 / fairness seal leftover.
- Репутация Радвея **5** есть (REP-01, product частично).
  `quests` runtime QST-ENG-01/02: NPC 271, три engine-квеста, USE 584,
  AREA leftover `START_FIGHT`, hunt loot-cap через quests-port. `economy` модуля нет.
  PRF-01: `catalog.professions` и
  `hero_professions` (пара 2+6). PRF-02: модуль `professions` владеет
  `hero_assistants` / `hero_farm_stats` / `farm_stocks` и sweep. PRF-03:
  `catalog.craft_recipes` / `hero_recipes`, recipe 61.

Во всех разделах ниже **API**, **события** и **шов извлечения** описывают
целевую границу. Они не доказывают регистрацию команды, наличие таблиц или
готовый сценарий; текущую реализацию определяют этот checkpoint и
[CAPABILITIES.md](../CAPABILITIES.md).

## Базовая форма

Система начинается как модульный монолит. Каждый модуль имеет:

- собственные Drizzle schema files и владеет изменениями своих таблиц;
- `application` API команд и запросов;
- доменную модель без Fastify, AMF и SQL наружу;
- адаптеры хранения и подписчики на события;
- публичный пакет `contracts`, который не экспортирует ORM-таблицы.

Вызов внутри одного пользовательского сценария идёт через типизированный API.
Если сценарий требует немедленной атомарности, application orchestrator
использует одну Drizzle transaction. Событие сообщает уже совершившийся факт и
не используется для синхронной проверки. Transactional outbox применяется там,
где событие действительно должно пережить commit и асинхронную доставку.

## Границы и контракты

### `identity`

**Владеет:** учётными записями, credentials, сессиями, блокировками и ролями операторов. Не владеет ником, уровнем или онлайном персонажа.

**API:** `registerAccount`, `authenticate`, `createSession`, `resolveSession`, `revokeSession`, `getAccount`.

**События:** `identity.account-registered.v1`, `identity.session-created.v1`, `identity.session-revoked.v1`.

**Шов извлечения:** HTTP auth и session middleware зависят только от `IdentityApi`. Возможен отдельный auth-service без изменений доменных модулей.

### `character`

**Владеет:** персонажем, именем и внешностью, уровнем/опытом, базовыми ресурсами, навыками, репутациями, настройками, текущим состоянием жизни. Координата персонажа хранится в `world`.

**API:** `createCharacter`, `getCharacter`, `getCharacterSheet`, `grantExperience`, `syncResources`, `noteHp`, `noteDefeat`, `resurrect`, `creditMoney`, `debitMoney`, `setArea`, `setAppearance`, `setPreference`, `grantReputation`.

**События:** `character.created.v1`, `character.level-changed.v1`, `character.sheet-changed.v1`, `character.defeated.v1`.

**Шов извлечения:** расчёт листа персонажа — чистый `CharacterRules`; запись результата выполняет модуль. Combat получает неизменяемый snapshot, а не строки `character`.

### `inventory`

**Владеет:** экземплярами предметов, стаками, контейнерами, экипировкой, поясом, прочностью и резервированием предметов.

**API:** `getInventory`, `grantItems`, `consumeItems`, `moveItem`, `equip`,
`unequip`, `drop`, `bagLoad`, `changeDurability`, `reserveItems`,
`commitReservation`, `releaseReservation`.

**События:** `inventory.changed.v1`, `inventory.item-equipped.v1`, `inventory.items-reserved.v1`, `inventory.reservation-released.v1`.

**Шов извлечения:** правила оперируют `ItemDefinition` из `catalog` через порт. Почта, аукцион, квесты и бой не меняют таблицы инвентаря — только команды/reservation.

### `catalog`

**Владеет:** опубликованными, версионированными определениями предметов, существ, заклинаний, уровней, наград, витрины магазина (`store_types` / `store_lots`), треков репутации (`reputation_tracks`) и общих справочников. Runtime читает только опубликованную ревизию. Кошелёк героя catalog не владеет.

**API:** `getItemDefinition`, `getCreatureDefinition`, `getSpellDefinition`, `getLevelCurve`, `getPublishedRevision`, `storeTypes`, `storeLots`, `reputationTrack` / `reputationTracks`; пакет snapshot/export для потребителей.

**События:** `catalog.revision-published.v1`.

**Шов извлечения:** read-only service или локальный versioned cache. Доменные записи хранят стабильные catalog ID и при необходимости snapshot существенных условий операции.

### `world`

**Владеет:** authored локациями и переходами (`areas`, `area_links`), hunt-spawn,
presence notices и process-local hunt overlay (xy, `fight_id`, owner; не
таблица). Persisted координата героя — `character.heroes.area_id` +
`move_ready_at`.

**API:** `area`, `linksFrom`, `requireLink`, `listPopulation`, `enterNotices`,
`leaveNotices`, `moveNotices`, `tryAcquireSpawn`, `releaseSpawn`,
`occupiedFightId`, `huntSnapshot`. Location write — character `setArea`.

**События:** `world.character-entered.v1`, `world.character-moved.v1`, `world.fact-changed.v1`, `world.spawn-acquired.v1`.

**Шов извлечения:** pathfinding и spawn scheduler — порты. Presence можно вынести в Redis/service, сохранив `WorldApi`.

### `combat`

**Владеет:** process-local активными боями, участниками, ходами, эффектами, RNG
state и outbound packets. В PostgreSQL владеет только завершённой
`finished_fights` history с TTL 72 часа. Не начисляет награды и не меняет
персонажа/инвентарь напрямую.

**API:** `startHunt`, `joinHunt`, `hasFight`, `execute`, `activeFightId`,
`resumeFight`, `accountForFight`, `takePocketConsume`, `takeExit`, `takeLoot`. Injected `CombatDelay`
(dueAt + cancel по fight id) и `CombatWake` для fproxy. Loadout snapshot
собирает `jugger-wire` из inventory/catalog ports; CMB-03 settlement —
composition UoW, не запись combat в `heroes`/`items`. CMB-04 reconnect —
тот же `activeFightId` на init2 `fight|conf`, без persist боя.
Mapper старого `arena|finished_fights` / info view существует в combat
application; OA `arena|finished_fights` и `fight_info.php` в текущем срезе
не регистрируются.

**События:** process-local turn/packet events и terminal `combat.finished.v1`.
`combat.finished` содержит подтверждённый outcome, но не утверждает, что награда
применена. События хода в БД не сохраняются.

**Шов извлечения:** единственный вход — transport-neutral commands; единственный
выход — packets, terminal result и `CombatView`. Active state при restart не
восстанавливается. Формат history берётся из старого эмулятора; решение —
[ADR-0020](../adr/ADR-0020-ephemeral-combat.md).

### `quests` — QST-ENG-01/02 runtime

**Владеет:** authored NPC/quest/dialog/goal/script/flag (`release_id`) и
player `hero_quests` / `hero_quest_goals` / `hero_facts` / waiting.
Не владеет bag, деньгами, area travel, active fight.

**API:** `board`, `answer`, `bookTrio`, `cancel`, `recordSignal`,
`beginAreaAction` / `finishAreaAction`, loot `needed(heroId, artikulId)`.
GRANT/consume/`START_FIGHT`/`MSG` — composition `QuestDesk`; hunt drop-cap —
`HuntFightSettlement` через тот же `needed`, не импорт владельцев в domain.

**События leftover:** `quests.accepted.v1` и outbox не вводятся, пока нет
асинхронного consumer.

**Шов извлечения:** `QuestSignal` из store/PUT_ON/`FightTerminalObserver`;
AREA leftover `START_FIGHT` после commit, как dialog. Контракт:
[QUESTS.md](../modules/QUESTS.md).

### `mail` — MAIL-02 runtime

**Владеет:** `mail.letters` (inbox/outbox copies) и снимками
`mail.letter_attachments`. Не владеет балансом, bag и chat.

**API:** `listInbox`, `listOutbox`, `delete`, `hasUnread`, `deliverPlayerPair`,
`lockInbox`, `markPicked`, `deliverSystemInbox`, `returnCodInbox`,
`sweepExpired`. Send/pick/COD — composition `MailSend` / `MailClaim` +
character money + inventory instance take/grant. Контракт:
[MAIL.md](../modules/MAIL.md).

**Шов извлечения:** не цель MAIL-02. Target mailbox в `social` ниже — план.

### `auction` — AUC-01 / AUC-02 runtime

**Владеет:** `auction.listings` (лоты, заказы и снимок/фильтры). Не владеет
балансом, bag и письмами.

**API:** `searchLots`, `searchTenders`, `listMine`, `listMyBids`,
`minUnitPriceMinor`, `insert`, `lock`, `lockExpired`, `save`. Add/bid/buyout/
cancel/tender fill/expiry — composition + character `debitMoney` + inventory
take + mail `deliverSystemInbox`. Контракт:
[AUCTION.md](../modules/AUCTION.md).

**Шов извлечения:** не цель AUC-01/AUC-02. Target listings в `economy` ниже —
план.

### `trade` — TRD-01 / TRD-02 runtime

**Владеет:** process-local сессией обмена (тарелки, `confirm_key`,
`confirmed`). Не владеет балансом и bag. Таблиц нет.

**API:** `request`, `confirm`, `put`, `putMoney`, `withdraw`, `ready`,
`sessionDecline`, `sessionConfirm`, `decline`. Put/withdraw/decline/settle —
composition + inventory take/grant + character money. Контракт:
[TRADE.md](../modules/TRADE.md).

**Шов извлечения:** не цель TRD-01/TRD-02. Target trade в `economy` ниже —
план.

### `chat` — SOC-01 runtime

**Владеет:** expand macros и fan-out policy. Не пишет `heroes` / combat /
inventory. Таблиц нет.

**API:** `add`, `deliverSystem`, `notifyHuntStarted`, `notifyFightEnded`.
Delivery — composition `ChatDesk` + esrv outbox. Combat не импортирует chat;
post-commit обёртка `ChatFightSettlement`. Контракт:
[CHAT.md](../modules/CHAT.md).

**Шов извлечения:** не цель SOC-01. Target channels в `social` ниже — план.

### `party` — SOC-02 / SOC-03 runtime

**Владеет:** persistent party, membership, invites, settings, `party_bag_items`.
Не пишет `heroes` / `inventory.items` / combat. Give/drop — composition UoW:
party bag row + `InventoryService.grantToBag`.

**API:** `create`, `invite`, `confirmInvite`, `kick`, `leave`, `disband`,
`changeLeader`, `saveSettings`, `searchList`, `join`, `depositBag`, `give`,
`drop`. Delivery — composition `PartyDesk` / `PartyBagOps` + esrv `2:`/`4:`.
Loot routing и HELP — composition ports, combat party-таблицы не импортирует.
Контракт: [PARTY.md](../modules/PARTY.md).

**Шов извлечения:** не цель SOC-02. Target groups в `social` ниже — план.

### `social` — после core

**Владеет:** друзьями/игнором, группами, приглашениями, каналами и сообщениями, mailbox как социальной доставкой (план; runtime mailbox — `mail`). Вложения письма — reservation/reference, не JSON-копия предмета.

**API:** `createParty`, `inviteToParty`, `changeParty`, `postMessage`, `sendMail`, `claimMail`, `getSocialSnapshot`.

**События:** `social.party-changed.v1`, `social.message-posted.v1`, `social.mail-sent.v1`, `social.mail-claimed.v1`.

**Шов извлечения:** realtime gateway подписан на события; chat/presence можно вынести отдельно без доступа к таблицам character/world.

### `economy` — после core

**Владеет:** кошельками, неизменяемым ledger, торговыми предложениями, ставками и денежными резервами. Authored витрина ECO-01/ECO-02 живёт в `catalog`, balance — на `heroes.money_minor` / `money_gold_minor`; лоты и заказы AUC-01/AUC-02 живут в `auction`; P2P обмен TRD-01/TRD-02 живёт в `trade` (RAM), не здесь. Этого модуля в runtime нет.

**API:** `getBalance`, `postTransfer`, `reserveFunds`. Покупка лота ECO-01/ECO-02 — composition, не `buyStoreLot`. Аукцион open/bid/buyout/cancel/tender fill — модуль `auction`. Обмен request/put/settle — модуль `trade`.

**События:** `economy.ledger-posted.v1`, `economy.listing-opened.v1`, `economy.trade-settled.v1`, `economy.listing-closed.v1`.

**Шов извлечения:** settlement — saga с inventory reservations и идемпотентными ключами. Аналитика рынка строит проекцию событий, не расширяет transactional schema.

### `professions` — PRF-01 licenses; PRF-02 jobs; PRF-03 craft

**Владеет (PRF-01):** нет runtime jobs. Catalog владеет `catalog.professions`;
character владеет `hero_professions` и `learnProfession`.

**Владеет (PRF-02):** `hero_assistants`, `hero_farm_stats`, `farm_stocks`,
DelayScheduler finish. Catalog: `assistant_types`, `farm_resources`,
`area_farms`.

**Владеет (PRF-03):** `hero_recipes`. Catalog: `craft_recipes`. Character
bump craft XP через port. USE `LEARN_RECIPE` — composition seam.
Контракт: [PROFESSIONS.md](../modules/PROFESSIONS.md).

**API leftover:** `craft|cook_list`.

**События leftover:** `professions.mastery-changed.v1`, `professions.gathering-finished.v1`, `professions.craft-finished.v1`.

**Шов извлечения:** каталог рецептов читается через catalog ports; ингредиенты и результат проходят атомарную orchestration с inventory.

### `instance` — DNG-01 / DNG-02

**Владеет:** dungeon copy rows, hero binds, unix expiry, killed-spawn
rows, dungeon enter policy. Не владеет party, outdoor areas/hunt и active
combat.

**API:** `enterCopy`, `requireLiveCopy`, `markSpawnKilled`, `listExpired`,
`DungeonHuntWorld` snapshot/lock/forget. Delivery `common|instance_conf` —
composition / jugger-wire. Контракт: [INSTANCE.md](../modules/INSTANCE.md).

**Шов извлечения:** не цель DNG-02. Target `instances` events ниже не
копировать в runtime.

### `battleground` — BG-01

**Владеет:** RAM queue/invite/ban/live score, typed
`battleground.finished_matches` / `finished_players`, Раскоп catalog card.
Не владеет copy row (`instance` `copy_type='bg'`), outdoor areas и active
PvP.

**API:** composition `BattlegroundDesk` (`arena|*`, `ATTACK`); queue
`add`/`delete`/`confirm`; history `record`/`list`. Контракт:
[BATTLEGROUND.md](../modules/BATTLEGROUND.md).

**Шов извлечения:** не цель BG-01. Combat не импортирует battleground;
composition overlays PvP `type:"1"` / `flags:"128"`.

### `content`

**Владеет:** versioned drafts, validation reports, immutable release bundles,
publication audit и active release pointer. Не обслуживает gameplay-запросы.

**API:** `saveDraft`, `buildCandidate`, `validateCandidate`,
`materializeRelease`, `activateRelease`, `getPublicationStatus`.

**События:** `content.release-activated.v1` сообщает уже завершившийся факт для
cache invalidation/observability. Оно не запускает отложенный частичный импорт.

**Шов извлечения:** editor позднее использует те же application ports. На первом
этапе pipeline остаётся внутри монолита и одного PostgreSQL; отдельный
content-service не вводится. Materialization versioned runtime rows является
частью publish flow, а не файловым dual-write.

### `jugger-wire`

**Владеет:** AMF3 codec, legacy URL/OA routing, cookie quirks, wire DTO, коды статусов, flat-envelope `init/init2`, fproxy/esrv и преобразование доменных ошибок.

**API:** inbound transport handlers и outbound mappers; доменного API наружу не предоставляет.

**События:** не публикует доменные события. Push строится из подписок на доменные события через собственный delivery/outbox cursor.

**Шов извлечения:** это anti-corruption layer. Ни один модуль не импортирует AMF types, live-названия (`money_gold`) или OA key. Новый REST/gRPC transport подключается к тем же application API.

Внутри `jugger-wire` transport разделён по протоколам (`auth`, OA, esrv,
fproxy, static). OA envelope после низкоуровневого decode попадает в статический
registry `object|action`; registry вызывает небольшой typed handler. Handler не
работает с `AmfValue` и не загружается через dynamic import. Подробности:
[CLIENT_COMMANDS.md](CLIENT_COMMANDS.md).

## Сценарии между модулями

Следующие сценарии — planned architecture, не текущие runtime flows:

- **Покупка:** wire → economy; economy резервирует деньги, вызывает inventory grant, затем проводит ledger. Повтор запроса безопасен по operation ID.
- **Завершение боя:** combat фиксирует результат → подписчики character/quests/instances; отдельный reward orchestrator вызывает economy/inventory. Combat не знает, человек перед ним или автоматический клиент.
- **Почта/аукцион:** runtime MAIL-02 / AUC-01 держат снимок, не reservation;
  social/economy reservation — план target.
- **`init/init2`:** jugger-wire запрашивает один bootstrap read model, а не вызывает последовательно все модули и не читает их таблицы.

Последний пункт уже действует для bootstrap read model; остальные появляются
только вместе с соответствующим capability slice.

## Architecture checkpoints для будущих волн

Перед глобальным refactor существующих модулей или первой реализацией
`economy`, `social` либо `instances` отдельный checkpoint обязан зафиксировать:

1. владельца durable и ephemeral state;
2. минимальные public ports и orchestration/transaction boundary;
3. idempotency, restart и concurrency semantics;
4. подтверждённый wire vertical slice и необходимые content references.

Checkpoint фиксируется в соответствующей записи
[ROADMAP.md](../migration/ROADMAP.md): `SOC-*`, `ECO-*`, `MAIL-01`, `AUC-01`,
`TRD-01`, `DNG-01` или `BG-01`, и проходит workflow из
[PLAYBOOK.md](../migration/PLAYBOOK.md). До него этот документ задаёт только
границу ответственности: он не задаёт target tables и не разрешает добавлять
outbox, ledger, reservations или instance schema «на будущее».

## Запрещённые сокращения

- общий `db/schema.ts` и импорт чужих ORM-объектов;
- `isBot`, `actorType=bot` и отдельные reward/rate ветки в домене;
- JSON-копии изменяемых сущностей вместо reservation/ID;
- вызов wire handlers из фоновых задач;
- общий `utils` с доменными правилами: правило живёт у владельца данных.
