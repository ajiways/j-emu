# Модули

Документ описывает ownership target. Реализованы `identity`, `character`,
`inventory`, `catalog`, `world`, `combat`, `content` и `jugger-wire`, но их
полный target API ещё не перенесён. `quests`, `social`, `economy`,
`professions` и `instances` ниже являются планом, а не возможностями runtime.
Фактический статус находится в [CAPABILITIES.md](../CAPABILITIES.md).

## Текущий runtime checkpoint

Текущий проверенный срез после готовых bootstrap, equipment
`PUT_ON`/`PUT_OFF`, bag DROP, pocket layout, world USE, area transitions и
area presence roster:

- `character` хранит hero scalars, personal details, naked `hero_skills`,
  `hp_time`, `regen_at`, `ghost` / `injury_time` / `injury_artikul_id`;
  internal ports `grantExperience`, `syncResources`, `noteHp`, `noteDefeat`,
  `resurrect`, `creditMoney` и `debitMoney` пишут этот state; `move_ready_at`
  и `setArea` на том же aggregate;
- `inventory` хранит bag/pocket/equipment instances и выполняет
  `PUT_ON`/`PUT_OFF` (paperdoll и пояс), `drop`, `useFromBag`, `bagLoad`,
  `grantToBag` и `listPocket`;
- `catalog` и `world` читают artifacts, skills, levels, appearance,
  game-wide bootstrap documents, areas 503/501/504, travel `area_links`, hunt
  503 и витрину 504 (`store_types` type `-131`, lots 23/24) из active release;
- equipment-derived skills/vitals считаются из persisted naked skills и
  artifact bonuses; migration `0004` закрепляет wear fields и occupancy slot;
  `0007` — artifact `price_minor`/`flags`/`bag_stack`;
  `0008` — partial unique pocket occupancy;
  `0009` — catalog `artifact_actions`;
  `0010` — `heroes.move_ready_at`;
  `0011` — `areas.parent_id` и `world.area_links`;
  `0015` — `heroes.ghost` / injury;
  `0016` — `catalog.store_types` / `store_lots`;
- `combat` — hunt lifecycle, CMB-02…04 reconnect/ghost settlement и finished
  history; `quests`, `social`, `economy`, `professions`, `instances` в runtime
  нет. Репутации ещё нет (REP-01).

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

**Владеет:** опубликованными, версионированными определениями предметов, существ, заклинаний, уровней, наград, витрины магазина (`store_types` / `store_lots`) и общих справочников. Runtime читает только опубликованную ревизию. Кошелёк героя catalog не владеет.

**API:** `getItemDefinition`, `getCreatureDefinition`, `getSpellDefinition`, `getLevelCurve`, `getPublishedRevision`, `storeTypes`, `storeLots`; пакет snapshot/export для потребителей.

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

### `quests` — план

**Владеет:** опубликованными определениями квестов/диалогов, прогрессом персонажа, целями и квестовыми фактами. Ссылается на catalog/world ID, но не владеет ими.

**API:** `listAvailableQuests`, `acceptQuest`, `answerDialog`, `recordSignal`, `turnInQuest`, `getQuestJournal`.

**События:** `quests.accepted.v1`, `quests.goal-progressed.v1`, `quests.completed.v1`, `quests.reward-requested.v1`.

**Шов извлечения:** входные `QuestSignal` создаются адаптерами событий combat/world/inventory. Награда исполняется saga через публичные API character/inventory/economy.

### `social` — после core

**Владеет:** друзьями/игнором, группами, приглашениями, каналами и сообщениями, mailbox как социальной доставкой. Вложения письма — reservation/reference, не JSON-копия предмета.

**API:** `createParty`, `inviteToParty`, `changeParty`, `postMessage`, `sendMail`, `claimMail`, `getSocialSnapshot`.

**События:** `social.party-changed.v1`, `social.message-posted.v1`, `social.mail-sent.v1`, `social.mail-claimed.v1`.

**Шов извлечения:** realtime gateway подписан на события; chat/presence можно вынести отдельно без доступа к таблицам character/world.

### `economy` — после core

**Владеет:** кошельками, неизменяемым ledger, торговыми предложениями, ставками и денежными резервами. Authored витрина ECO-01 живёт в `catalog`, balance — на `heroes.money_minor`; этого модуля в runtime нет.

**API:** `getBalance`, `postTransfer`, `reserveFunds`, `openListing`, `placeBid`, `buyout`, `cancelListing`. Покупка лота ECO-01 — composition, не `buyStoreLot`.

**События:** `economy.ledger-posted.v1`, `economy.listing-opened.v1`, `economy.trade-settled.v1`, `economy.listing-closed.v1`.

**Шов извлечения:** settlement — saga с inventory reservations и идемпотентными ключами. Аналитика рынка строит проекцию событий, не расширяет transactional schema.

### `professions` — отложено

**Владеет:** изученными профессиями/рецептами, помощниками, работами на ресурсных узлах, мастерством и cooldown.

**API:** `learnProfession`, `learnRecipe`, `startGathering`, `claimGathering`, `craft`, `getProfessionState`.

**События:** `professions.mastery-changed.v1`, `professions.gathering-finished.v1`, `professions.craft-finished.v1`.

**Шов извлечения:** каталог рецептов и узлов читается через catalog/world ports; ингредиенты и результат проходят атомарную orchestration с inventory.

### `instances` — отложено

**Владеет:** копиями подземелий/BG, membership, checkpoint, bind, lifecycle и итоговой историей инстанса. Не владеет party и combat.

**API:** `createInstance`, `enterInstance`, `recordEncounterResult`, `leaveInstance`, `expireInstance`, `getInstanceView`.

**События:** `instances.created.v1`, `instances.member-entered.v1`, `instances.checkpoint-reached.v1`, `instances.completed.v1`, `instances.expired.v1`.

**Шов извлечения:** party ID и combat ID — внешние ссылки; инстанс координирует сценарий через API/events.

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
- **Почта/аукцион:** social/economy резервируют item IDs через inventory; владение меняется только командой inventory после settlement.
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
