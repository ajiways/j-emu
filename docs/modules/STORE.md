# Store (ECO-01)

## Статус

Вход в лавку 504 **готово** (WLD-01). `store|list` / `store|buy` для q_5
лотов 23/24 реализованы на raw-AMF (ECO-01 architecture close). CEF лавки
ещё не прогонялся — product-status **готово** не ставить. Точный
product-status: [CAPABILITIES.md](../CAPABILITIES.md).

## Источники поведения

- `jgr-emu/docs/STORE.md`;
- `_research/samples/STORE.md`;
- `jgr-emu/src/store.ts`, `routes/oa/stubs.ts` (`dispatchStore`);
- authored `jgr-emu/fixtures/stores/504.json`;
- quest evidence `jgr-emu/fixtures/quests_curated/q_5.json` (купить артикулы
  **23** и **24** в деревенской лавке).

Не переносить dual-write редактора, seed-фикстуру в runtime, `noteQuestBuy`,
алмазную конвертацию 1:900 и полный каталог 23 файлов (ECO-02).

## Architecture decision

Отдельный `ARC-ECO` не нужен. Деньги остаются `heroes.money_minor` за
character port. Модуля `economy`, второго баланса и ledger нет.

Catalog владеет authored витриной (`store_types`, `store_lots`) на active
release. World уже владеет area **504** с `code=store`. Inventory выдаёт
экземпляры в bag. Composition UoW (`src/app`, как `HuntFightSettlement`)
вызывает `debitMoney` + `grantToBag`. Inventory не пишет `heroes`. Character
не пишет `items`. Store OA не импортирует combat domain (в том числе
`fight-money.ts`); перевод золотых монет в minor — helper в character/shared
kernel, то же правило, что INV-02: **1.00 золота = 100 minor**.

`FightRules` на `store|*` не ставить: live [FIGHT_LOCK.md](../../../jgr-emu/docs/FIGHT_LOCK.md)
магазин в бою не блокирует. Ghost — named CharacterRules: `store|buy` при
`hero.ghost` → **203** + `error` (map `GhostHeroError`). Dump-текста в
`store.ts` нет; не выдавать `100` и не маскировать призрак пустой корзиной.

Вход в 504 без `assertStoreEntry`: в `504.json` нет `requires`. RANK /
REPUTATION лотов 23/24 тоже нет — парсер описания артикула в ECO-01 не
нужен.

## Content set (`playable-slice/v12` → **v13**)

Публиковать только dump-proven минимум для q_5:

| Что              | Provenance                                                                                                                       | Не публиковать                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Area 504         | уже WLD-01                                                                                                                       | остальные store-area                         |
| Types 504        | только `-131` «Оружие и доспехи» — единственная вкладка с лотами 23/24                                                           | `159`/`10`/`21` и вкладки других лавок       |
| Lots             | artikul **23** `lot_id` **80** `type_id` **-131** `price` **1**; artikul **24** `lot_id` **82** `type_id` **-131** `price` **1** | остальные лоты `504.json` (1, 79, 21, 26, …) |
| Artifacts 23, 24 | Pub1 `artifact_artikul_*.amf`; titles/slots как dump `user_view_slim` (перчатка slot_mask 32, наруч 16)                          | полный Pub1 catalog (DATA-02)                |

В `504.json` у вкладок `159`/`10`/`21` есть лоты (еда с дробной ценой, badge,
алмазный быстрый старт) — их не публикуем. Тип без лотов на wire даёт CEF
спиннер «загрузка данных»; validator отклоняет такой type. Пустой `store|list`
(нет types и нет artikuls, как вне лавки / area без витрины) — live `100`.
Лота без опубликованного artifact в candidate быть не может. Не выдумывать
price, badge алмазов, `requires` или `cnt`.

Поля артефакта — тот же validator, что DATA-01 (title, picture, type_id,
kind_id, slot_mask, price_minor, flags, bag_stack, skills, extra). `type_id`
лота (**-131**) и `type_id` артикула в bag (dump `"2"`) не смешивать.
`user_view_slim` — evidence, не runtime source.

## Schema (catalog)

Миграция в срезе ECO-01, не «на будущее»:

- `catalog.store_types(release_id, area_id, type_id, title, ord)` PK
  `(release_id, area_id, type_id)`; FK `world.areas` той же release;
- `catalog.store_lots(release_id, area_id, lot_id, artikul_id, type_id, price,
ord)` PK `(release_id, area_id, lot_id)`; FK `artifacts` той же release;
  `price` — золотые монеты, целое ≥ 0 (в срезе 1).

Бейджи / `extra_json` / diamond / artifact-currency колонки не добавлять, пока
нет dump-лота в срезе.

## Public ports

Catalog: `storeTypes(areaId)`, `storeLots(areaId)` — только active release.
Пустая витрина для area без rows — валидно (503). Отсутствие **обязательного**
504 в slice после v13 — ошибка публикации, не пустой `100` в лавке.

Character: `debitMoney({ characterId, minorUnits })` — положительное целое;
недостаточно средств — typed error, баланс не клампится в 0 и не уходит в
минус; итог в `[0, 2_147_483_647]`. Та же hero-row lock / UoW, что
`creditMoney`.

Inventory: существующий `grantToBag({ characterId, artifactId, quantity })`.

World: `area.code === "store"` для buy (уже колонка). Character/wire не читают
world tables напрямую — port.

Composition `StorePurchase`: одна UoW на весь basket. Сбой grant откатывает
debit. `noteQuestBuy` / book piggyback не вызывать.

## Wire

`store|list` — nested `{ status, types, artikuls }` (не flat). `types` —
map индекс→`{id,title,ord}`. Элемент `artikuls` — dump-поля live
`buildLotWire` из **опубликованного** artifact; missing catalog field →
**204**, не `title ?? \`Артикул ${id}\``. Lookup лота на buy: `lot_id`, затем
`artikul_id` (бейджей в срезе нет).

`store|buy` — flat: `store|buy` `{status:100}`, `user|bag`, `state`. Quest
book trio не piggyback. Уровень героя **не** гейт покупки (`PUT_ON` позже).

Dump-proven отказы **status 2** + `error` (это live store, не 203/204):

| Исход                          | `error`                    |
| ------------------------------ | -------------------------- |
| area не `code=store`           | `Здесь нельзя торговать`   |
| пустая / отсутствующая корзина | `пустая корзина`           |
| неизвестный ключ лота          | `неизвестный товар ${key}` |
| не хватает золота              | `Недостаточно денег`       |

`store|list` вне лавки: live отдаёт пустые `types`/`artikuls` `status:100` —
тот же контракт, не 203.

Ghost buy: **203** + `error` (не status 2). Fight: не блокировать.

`store|repair`, OPEN_STORE, NPC board, diamond `price_type:3`, bag-artikul
currency, dual-badge — out of scope.

## Fail-fast

Не копировать live `cat?.title ??`, `?? {}` как маскировку обязательного
каталога 23/24. Отсутствующий artifact на опубликованном лоте — 204.
Тип без лотов — ошибка публикации, не пустая вкладка (CEF зависает).
Недостаточный gold — 2, не молчаливый `creditMoney(-n)`. Нет fallback на
другой лот/артикул.

## Restart / concurrency

`money_minor` и bag rows переживают reconnect/restart. Hero + items lock в
одной UoW. Process restart не откатывает покупку.

## Out of scope

ECO-02 полный `stores/*.json`; DATA-02 catalog; RANK/REPUTATION; diamonds;
dungeon coins 724; `store|repair`; quest signals; economy ledger; `assertStoreEntry`.
Пустые вкладки `159`/`10`/`21` без лотов. SQL FK `store_types` → `world.areas`
нет: area проверяет publication. Ghost `203` несёт `GhostHeroError` message
(английский `cannot debitMoney while ghosted`); dump-proven русский toast
на buy-призрак не найден. Concurrent buy e2e нет — сериализация через hero
row lock, как DROP.

## Acceptance

- unit: gold→minor для `price` 1; debit insufficient; lot lookup lot_id /
  artikul_id; list wire без missing-catalog fallback;
- integration: publication v13 с 23+24; lot без artifact отклоняет candidate;
  concurrent buy одного золота — один победитель;
- raw-AMF: COME_IN 504 → `store|list` type `-131`, лоты 23 и 24; buy обоих
  (starter `25.00` → `23.00`), bag instances, reconnect/restart; buy в 503 →
  2; пустая корзина → 2; неизвестный лот → 2; ghost → 203;
- CEF: лавка, купить перчатку и наруч, иконки в bag — обязательно для
  product **готово**; до CEF store остаётся неперенесённым / частичным.
