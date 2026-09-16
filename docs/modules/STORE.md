# Store (ECO-01 / ECO-02)

## Статус

Вход в лавку 504 **готово** (WLD-01). Generic `store|list` / `store|buy`
(gold / diamond / barter, RANK / REPUTATION / LEVEL на лоте) реализованы на
raw-AMF (ECO-02 architecture close). CEF лавки ещё не прогонялся —
product-status **готово** не ставить. Точный product-status:
[CAPABILITIES.md](../CAPABILITIES.md).

## Источники поведения

- `jgr-emu/docs/STORE.md`;
- `_research/samples/STORE.md`;
- `jgr-emu/src/store.ts`, `storePay.ts`, `storeAccess.ts`,
  `routes/oa/stubs.ts` (`dispatchStore`);
- authored `jgr-emu/fixtures/stores/504.json`, `552.json`;
- quest evidence `jgr-emu/fixtures/quests_curated/q_5.json` (купить артикулы
  **23** и **24** в деревенской лавке).

Не переносить dual-write редактора, seed-фикстуру в runtime, `noteQuestBuy`,
алмазную конвертацию 1:900. Полный каталог 23 dumps уже в DATA-05
(`npm run content:decode:economy`).

## Architecture decision

Отдельный `ARC-ECO` не нужен. Деньги остаются `heroes.money_minor` /
`heroes.money_gold_minor` за character port. Модуля `economy`, второго
баланса, ledger и `src/modules/store-engine` нет.

Catalog владеет authored витриной (`store_types`, `store_lots`) на active
release. `store_lots.pay` — дискриминированный union `gold` / `diamond` /
`barter` / `bundle`. `bundle` — несколько бартер-артикулов и опционально
золото на одном лоте (live `moneyFromBadge` + `artifactCostsFromBadge`
по **первому** badge). `store_lots.requires` — nullable jsonb;
`null` = нет гейта лота; `{all}` AND или `{any}` OR.
World владеет area **504** и **552** с `code=store`. Inventory выдаёт
экземпляры в bag и списывает бартер. Composition UoW (`src/app`, как
`HuntFightSettlement`) вызывает gate → pay → `grantToBag`. Inventory не
пишет `heroes`. Character не пишет `items`. Store OA не импортирует combat
domain (в том числе `fight-money.ts`); перевод золотых и алмазных монет в
minor — helper в character/shared kernel, то же правило, что INV-02:
**1.00 = 100 minor**. Buy не конвертирует алмазы 1:900; dump-фикстуры уже
переписали diamond-лоты в золото на seed.

`FightRules` на `store|*` не ставить: live [FIGHT_LOCK.md](../../../jgr-emu/docs/FIGHT_LOCK.md)
магазин в бою не блокирует. Ghost — named CharacterRules: `store|buy` при
`hero.ghost` → **203** + `error` (map `GhostHeroError` **до** pay, action
`storeBuy`). Dump-текста в `store.ts` нет; не выдавать `100` и не маскировать
призрак пустой корзиной.

Вход в 504/552 без `assertStoreEntry`: в slice JSON нет `"type": "LEVEL"` и
нет `deny_error`. `storeEntryDeny` существует как доменное правило для
будущего COME_IN; ComeIn его не вызывает. RANK / REPUTATION / LEVEL на лоте
считает `storeRequiresDeny` до списания.

## Pay

| `pay.currency` | Списание                                                            | Нехватка (status **2**)          |
| -------------- | ------------------------------------------------------------------- | -------------------------------- |
| `gold`         | `debitMoney` (`money_minor`)                                        | `Недостаточно денег`             |
| `diamond`      | `debitMoneyGold` (`money_gold_minor`)                               | `Недостаточно алмазов`           |
| `barter`       | `countBagByArtifact` + `consumeFromBag` по **catalog `artikul_id`** | `Недостаточно: ${catalog.title}` |
| `bundle`       | gold till + каждый barter cost                                      | те же статусы 2, что gold/barter |

Gold `pay.amount` обязан совпадать с `price` (в minor через то же правило
1.00 = 100, до двух десятичных). Бартер не смотрит на
`items.id` инстанса. Старый runtime требовал id оригинала так, будто это
instance id — покупка не находила стек. Здесь consume сортирует bag rows с
тем же `artifactId` по instance `id` и списывает quantity. Missing catalog
title на бартере — fail-fast, не `артикул ${id}`.

## Lot gates (status **203**)

`honorProgress(hero.honor, hero.level)` из `common_conf.rank_info` +
`rank_table`. Dump `rank_info` длиннее `rank_table` (лишние titles без
порога) — это норма; у каждой строки `rank_table` обязан быть title.
Missing rank title — ошибка, не `TITLES[id] ?? TITLES[0]`.
`minLevelForRank`: id≤3 → L1, id≤30 → id+4, иначе 35.

| `requires.all[].type` | Deny `error`                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `RANK`                | `Нужно звание «${title}».`                                                                                   |
| `REPUTATION`          | `Нужно N репутации ${shortTitle}.` (`shortTitle` снимает префикс `^Репутация\s+`; missing track — fail-fast) |
| `LEVEL`               | `Нельзя купить этот товар.`                                                                                  |

Неизвестный type — ошибка публикации/парсера, не skip. Live RANK/REPUTATION
deny — **203**; pay shortage — **2**.

## Content set (DATA-05)

23 authored dumps `content/stores/*.json` → `store-types.generated.json` /
`store-lots.generated.json` (113 types, 2095 lots). E2e-representative
rows 504 `-131` lots 80/23 и 82/24, 552 type 11 lot 438/621 RANK min 4
сохраняются. Dump `lot_id` 0 публикуется как `lotId = artikulId`. Till —
первый badge (live lookup по lot_id/artikul). Gold-only shelf `price`
равна till. Leftover diamond — ошибка decode. Area-level `entries`
не публикуются. REPUTATION object 36 на лоте — derived SUM, не catalog
track. Пустые area 984/1102/1113 по-прежнему без store JSON.

| Что              | Provenance                                                                                                        | E2e pin / не этот контракт                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Area 504         | dump «Деревенская лавка», `code=store`                                                                            | COME_IN из 503 item 5                          |
| Types 504        | `-131` «Оружие и доспехи» плюс `159`/`10`/`21`                                                                    | list содержит `-131`; остальные вкладки не pin |
| Lots 504         | artikul **23** `lot_id` **80**; artikul **24** `lot_id` **82**; `pay: gold 1`                                     | buy обоих; полный список лотов 504 не pin      |
| Artifacts 23, 24 | Pub1 `artifact_artikul_*.amf`                                                                                     |                                                |
| Area 495         | dump «Площадь Бранендаля»; dump `parent_id` **494** нет в `radvei_areas.json` `areas` keys → slice `parentId: ""` | walk из 503                                    |
| Area 552         | dump «Арсенал», `code=store`, parent 495                                                                          | `setArea` 552 в e2e                            |
| Types 552        | **11** «Ювелирные изделия» плюс остальные вкладки dump                                                            | list содержит **11**                           |
| Lot 552          | `lot_id` **438**, artikul **621** «Амулет громилы», gold 300, `requires.RANK min 4`                               | buy 438 → 203 «Громила»                        |
| Artifact 621     | Pub1 catalog                                                                                                      |                                                |
| Links            | dump 495 item **238** → 552; 552 item **0** exit → 495                                                            | COME_IN 552 из 503                             |

Тип без лотов на wire даёт CEF спиннер «загрузка данных»; validator отклоняет такой
type. Пустой `store|list` (нет types и нет artikuls, как вне лавки / area без
витрины) — live `100`. Лота без опубликованного artifact в candidate быть не
может.

Поля артефакта — тот же validator, что DATA-01. `type_id` лота (**-131** / **11**)
и `type_id` артикула в bag (dump `"2"` / `"11"`) не смешивать.

E2E 552: `characterLocation.setArea({ areaId: "552" })` — walk из 503 в slice
нет.

## Schema (catalog)

- `catalog.store_types(release_id, area_id, type_id, title, ord)` PK
  `(release_id, area_id, type_id)`;
- `catalog.store_lots(release_id, area_id, lot_id, artikul_id, type_id, price,
ord, pay jsonb not null, requires jsonb)` PK `(release_id, area_id, lot_id)`;
  FK `artifacts` и `store_types` той же release; `lot_id > 0` (dump `lot_id: 0`
  публикуется как `lotId = artikulId`);
  `price` — золотые монеты, `double precision` ≥ 0, до двух десятичных;
  `requires` null = нет гейта.

Diamond / barter / RANK колонки отдельно не плодить: это jsonb `pay` /
`requires`. `store_entries` / come-in LEVEL table нет.

## Public ports

Catalog: `storeTypes(areaId)`, `storeLots(areaId)` — только active release.
Пустая витрина для area без rows — валидно (503). Отсутствие обязательных
504/552 в slice после v20 — ошибка публикации, не пустой `100` в лавке.

Character: `debitMoney` / `debitMoneyGold` — положительное целое; недостаточно
средств — typed error, баланс не клампится в 0 и не уходит в минус; итог в
`[0, 2_147_483_647]`. Та же hero-row lock / UoW, что `creditMoney`.

Inventory: `grantToBag`; бартер — `countBagByArtifact` /
`consumeFromBag({ artifactId })`.

World: `area.code === "store"` для buy (уже колонка). Character/wire не читают
world tables напрямую — port.

Composition `StorePurchase`: одна UoW на весь basket. Gate до pay. Сбой grant
откатывает debit. `noteQuestBuy` / book piggyback не вызывать.

## Wire

`store|list` — nested `{ status, types, artikuls }` (не flat). `types` —
map индекс→`{id,title,ord}`. Элемент `artikuls` — dump-поля live
`buildLotWire` из **опубликованного** artifact; missing catalog field →
**204**, не `title ?? \`Артикул ${id}\``. Lookup лота на buy: `lot_id`, затем
`artikul_id` (бейджей в срезе нет). Гейт не прячет лот со списка.

`store|buy` — flat: `store|buy` `{status:100}`, `user|bag`, `state`. Quest
book trio не piggyback. Уровень героя на PUT_ON — не этот контракт; LEVEL на
лоте — 203 выше.

Dump-proven отказы **status 2** + `error` (live store pay/shape, не 203/204):

| Исход                          | `error`                    |
| ------------------------------ | -------------------------- |
| area не `code=store`           | `Здесь нельзя торговать`   |
| пустая / отсутствующая корзина | `пустая корзина`           |
| неизвестный ключ лота          | `неизвестный товар ${key}` |
| не хватает золота              | `Недостаточно денег`       |
| не хватает алмазов             | `Недостаточно алмазов`     |
| не хватает бартер-стека        | `Недостаточно: ${title}`   |

Live RANK/REPUTATION (и LEVEL на лоте) — **status 203** + `error` из таблицы
гейтов.

`store|list` вне лавки: live отдаёт пустые `types`/`artikuls` `status:100` —
тот же контракт, не 203.

Ghost buy: **203** + `error` (не status 2). Fight: не блокировать.

OPEN_STORE — QST-ENG-05 landed ([QUESTS.md](QUESTS.md)): dialog leftover
op, штатный ComeIn в `code=store` area + `jump:"area"`. Не piggyback
`store|list`. NPC board `code=store` и dual-badge — out of scope.

## INV-05 — `store|repair`

OA уже существует как `store|*`; ремонт — inventory state + character
`debitMoney`, не новый store catalog. Live `handleStoreRepair` не требует
`area.code=store`. Composition `StoreRepair` в `src/app`. Контракт
формулы и ошибок — [INVENTORY.md](INVENTORY.md) INV-05.

`store|list` durability/durability_max — catalog template на лоте.

## Fail-fast

Не копировать live `cat?.title ??`, `?? {}` как маскировку обязательного
каталога. Отсутствующий artifact на опубликованном лоте — 204.
Тип без лотов — ошибка публикации, не пустая вкладка (CEF зависает).
Недостаточный gold/diamond — 2, не молчаливый `creditMoney(-n)`. Нет fallback
на другой лот/артикул. Бартер не матчит instance `items.id`. Missing honor
rank title / reputation track — ошибка, не пустая строка.

## Restart / concurrency

`money_minor`, `money_gold_minor` и bag rows переживают reconnect/restart.
Hero + items lock в одной UoW. Process restart не откатывает покупку.

## Out of scope

Diamond JSON conversion 1:900; extra badge SKUs на `store|list` (`badge_data`);
COME_IN `assertStoreEntry` / `store_entries`; quest signals кроме QST-ENG-05
`OPEN_STORE`; economy ledger. NPC board store-строка; dual-badge. SQL FK
`store_types` → `world.areas` нет: area проверяет publication. Ghost `203`
несёт `GhostHeroError` message (английский `cannot storeBuy while ghosted`);
dump-proven русский toast на buy-призрак не найден. Concurrent buy e2e нет —
сериализация через hero row lock, как DROP.

## Acceptance

- unit: gold/diamond→minor; debit insufficient; barter consume by `artifactId`
  (instance id ≠ artikul не списывает чужой стек и не считает его валютой);
  lot lookup lot_id / artikul_id; RANK deny «Громила» до debit; unknown
  require type fail-closed; list wire без missing-catalog fallback;
- integration: publication v20 с 23+24 и 621/438 RANK; lot без artifact
  отклоняет candidate; gold pay ≠ price отклоняет candidate;
- raw-AMF: COME_IN 504 → `store|list` type `-131`, лоты 23 и 24; buy обоих
  (starter `25.00` → `23.00`), bag instances, reconnect/restart; buy в 503 →
  2; пустая корзина → 2; неизвестный лот → 2; ghost → 203 `storeBuy`;
  setArea 552 → list type 11 artikul 621, buy 438 → 203 `Нужно звание
«Громила».`, лот остаётся в list;
- raw-AMF `store|repair`: 9095 0/3 → 2/2 без списания; 20 → 29/29 и `24.98`;
  already-full 203; ghost не блокирует; esrv `user|bag_diff.changed` ставит
  `actions` с PUT_ON;
- CEF: лавка, купить перчатку и наруч, иконки в bag; Арсенал RANK plaque —
  обязательно для product **готово**; до CEF store остаётся частичным.
  Мастерская INV-05 тоже без CEF.
