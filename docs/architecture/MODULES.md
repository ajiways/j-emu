# Модули

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

**API:** `createCharacter`, `getCharacter`, `getCharacterSheet`, `grantExperience`, `changeResource`, `setAppearance`, `setPreference`, `grantReputation`.

**События:** `character.created.v1`, `character.level-changed.v1`, `character.sheet-changed.v1`, `character.defeated.v1`.

**Шов извлечения:** расчёт листа персонажа — чистый `CharacterRules`; запись результата выполняет модуль. Combat получает неизменяемый snapshot, а не строки `character`.

### `inventory`

**Владеет:** экземплярами предметов, стаками, контейнерами, экипировкой, поясом, прочностью и резервированием предметов.

**API:** `getInventory`, `grantItems`, `consumeItems`, `moveItem`, `equip`, `unequip`, `changeDurability`, `reserveItems`, `commitReservation`, `releaseReservation`.

**События:** `inventory.changed.v1`, `inventory.item-equipped.v1`, `inventory.items-reserved.v1`, `inventory.reservation-released.v1`.

**Шов извлечения:** правила оперируют `ItemDefinition` из `catalog` через порт. Почта, аукцион, квесты и бой не меняют таблицы инвентаря — только команды/reservation.

### `catalog`

**Владеет:** опубликованными, версионированными определениями предметов, существ, заклинаний, уровней, наград и общих справочников. Runtime читает только опубликованную ревизию.

**API:** `getItemDefinition`, `getCreatureDefinition`, `getSpellDefinition`, `getLevelCurve`, `getPublishedRevision`; пакет snapshot/export для потребителей.

**События:** `catalog.revision-published.v1`.

**Шов извлечения:** read-only service или локальный versioned cache. Доменные записи хранят стабильные catalog ID и при необходимости snapshot существенных условий операции.

### `world`

**Владеет:** локациями и переходами, текущим местоположением персонажа, presence, hunt-spawn и их блокировками, мировыми фактами/флагами.

**API:** `enterWorld`, `moveCharacter`, `getLocation`, `getAreaView`, `setFact`, `acquireSpawn`, `releaseSpawn`, `listPresence`.

**События:** `world.character-entered.v1`, `world.character-moved.v1`, `world.fact-changed.v1`, `world.spawn-acquired.v1`.

**Шов извлечения:** pathfinding и spawn scheduler — порты. Presence можно вынести в Redis/service, сохранив `WorldApi`.

### `combat`

**Владеет:** process-local активными боями, участниками, ходами, эффектами, RNG
state и outbound packets. В PostgreSQL владеет только завершённой
`finished_fights` history с TTL 72 часа. Не начисляет награды и не меняет
персонажа/инвентарь напрямую.

**API:** `startCombat`, `joinCombat`, `submitAction`, `getCombatView`,
`abortCombat`, `listFinishedFights`, `getFinishedFightInfo`.

**События:** process-local turn/packet events и terminal `combat.finished.v1`.
`combat.finished` содержит подтверждённый outcome, но не утверждает, что награда
применена. События хода в БД не сохраняются.

**Шов извлечения:** единственный вход — transport-neutral commands; единственный
выход — packets, terminal result и `CombatView`. Active state при restart не
восстанавливается. Формат history берётся из старого эмулятора; решение —
[ADR-0015](../adr/ADR-0015-ephemeral-combat-and-finished-history.md).

### `quests`

**Владеет:** опубликованными определениями квестов/диалогов, прогрессом персонажа, целями и квестовыми фактами. Ссылается на catalog/world ID, но не владеет ими.

**API:** `listAvailableQuests`, `acceptQuest`, `answerDialog`, `recordSignal`, `turnInQuest`, `getQuestJournal`.

**События:** `quests.accepted.v1`, `quests.goal-progressed.v1`, `quests.completed.v1`, `quests.reward-requested.v1`.

**Шов извлечения:** входные `QuestSignal` создаются адаптерами событий combat/world/inventory. Награда исполняется saga через публичные API character/inventory/economy.

### `social`

**Владеет:** друзьями/игнором, группами, приглашениями, каналами и сообщениями, mailbox как социальной доставкой. Вложения письма — reservation/reference, не JSON-копия предмета.

**API:** `createParty`, `inviteToParty`, `changeParty`, `postMessage`, `sendMail`, `claimMail`, `getSocialSnapshot`.

**События:** `social.party-changed.v1`, `social.message-posted.v1`, `social.mail-sent.v1`, `social.mail-claimed.v1`.

**Шов извлечения:** realtime gateway подписан на события; chat/presence можно вынести отдельно без доступа к таблицам character/world.

### `economy`

**Владеет:** кошельками, неизменяемым ledger, торговыми предложениями, ставками, магазинами и денежными резервами. Названия валют доменные (`gold_coin`, `diamond`), live-поля преобразует wire.

**API:** `getBalance`, `postTransfer`, `reserveFunds`, `openListing`, `placeBid`, `buyout`, `cancelListing`, `buyStoreLot`.

**События:** `economy.ledger-posted.v1`, `economy.listing-opened.v1`, `economy.trade-settled.v1`, `economy.listing-closed.v1`.

**Шов извлечения:** settlement — saga с inventory reservations и идемпотентными ключами. Аналитика рынка строит проекцию событий, не расширяет transactional schema.

### `professions`

**Владеет:** изученными профессиями/рецептами, помощниками, работами на ресурсных узлах, мастерством и cooldown.

**API:** `learnProfession`, `learnRecipe`, `startGathering`, `claimGathering`, `craft`, `getProfessionState`.

**События:** `professions.mastery-changed.v1`, `professions.gathering-finished.v1`, `professions.craft-finished.v1`.

**Шов извлечения:** каталог рецептов и узлов читается через catalog/world ports; ингредиенты и результат проходят атомарную orchestration с inventory.

### `instances`

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

- **Покупка:** wire → economy; economy резервирует деньги, вызывает inventory grant, затем проводит ledger. Повтор запроса безопасен по operation ID.
- **Завершение боя:** combat фиксирует результат → подписчики character/quests/instances; отдельный reward orchestrator вызывает economy/inventory. Combat не знает, человек перед ним или автоматический клиент.
- **Почта/аукцион:** social/economy резервируют item IDs через inventory; владение меняется только командой inventory после settlement.
- **`init/init2`:** jugger-wire запрашивает один bootstrap read model, а не вызывает последовательно все модули и не читает их таблицы.

## Запрещённые сокращения

- общий `db/schema.ts` и импорт чужих ORM-объектов;
- `isBot`, `actorType=bot` и отдельные reward/rate ветки в домене;
- JSON-копии изменяемых сущностей вместо reservation/ID;
- вызов wire handlers из фоновых задач;
- общий `utils` с доменными правилами: правило живёт у владельца данных.
