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

## Bootstrap — готово

Есть raw-AMF E2E и подтверждённый CEF smoke-test: после cold login экран
загружается, HUD и локация 503 видны, bootstrap не отдаёт `203/204`.

- numeric account/hero identity;
- persisted hero, skills, HP/MP/EXP, appearance и personal details;
- полный flat состав `common|init` и `common|init2` из jgr-emu baseline
  (без party restore; `fight|conf` на init2 только пока RAM-бой жив);
- `user|skills`, magic, view, conf, unitframe, bag/pocket;
- authored `common|conf`, empty chrome и level/appearance catalog из active
  release;
- starter bag/pocket;
- area 503 и authored hunt rows;
- persisted tutorial completion flags;
- cold login, reconnect и process restart bootstrap.

## Character — частично

Есть persisted naked HP/MP/EXP, skills и appearance, достаточные для HUD после
bootstrap. Internal `grantExperience` атомарно применяет DATA-01 L1–L8 curve,
переживает reconnect/restart и не имеет production OA/CEF consumer. Internal
`syncResources` / `noteHp` применяют lazy HP regen с `regen_at` и `hp_time`
без ticker и без CEF gate; `mp_time` остаётся HUD `0`.

Не перенесено:

- CEF confirmation of CMB-03 result screen / HP-EXP-bag after exit;
- CEF ghost/injury/RESURRECT (raw-AMF CMB-04 есть);
- honor progression;
- клиентский EXP grant через квест.

Equipment-derived `user|skills` / `hpMax` считаются из naked skills + надетых
предметов (перчатка 9095 даёт VIT+5). Без экипа HUD показывает naked L1.

## Inventory equipment — готово

Есть raw-AMF E2E и подтверждённый CEF-прогон: перчатка 9095 надевается,
иконка/статы карточки видны, paperdoll slot 32, bag освобождается, HUD stats
меняются.

- catalog projection и stable item instance IDs;
- starter 9095 в bag (`greyset5_lhand.png`, `artifact_skills`);
- `PUT_ON`/`PUT_OFF` через `common|action` и `common|object`;
- occupancy displace, level/gender/type gates (`203` + `error`);
- согласованный flat bag/view/pocket/skills/unitframe/conf/state;
- equipment vitals на mutation, bootstrap и reconnect/restart.

## Inventory bag DROP — готово

Есть raw-AMF E2E и подтверждённый CEF-прогон: перчатку 9095 выбрасывают из
bag, деньги остаются `25.00`, bag пуст, reconnect совпадает с PostgreSQL.

- catalog v6: `priceMinor`/`flags`/`bagStack` на 9095 (`0`/`40`/`1`);
- `user|bag.amount` считает только взвешенные слоты (`9095` → `amount=0`,
  `total=1`); `amount_max=20`;
- OA `DROP` (и alias `SELL`) → flat `common|action` + bag/skills/mount_list/state;
- throw-away 9095 не меняет деньги; equipped DROP и SELL без `sell_price>0` —
  `204` с live `error`;
- DROP в активном hunt-бою запрещён (`FightRules` `203`; live сервер это не
  режет, j-emu закрывает дыру из [FIGHT_LOCK.md](../../jgr-emu/docs/FIGHT_LOCK.md));
- `creditMoney` на character в той же UoW; inventory не пишет `heroes`.

## Inventory pocket — готово

Есть raw-AMF E2E и подтверждённый CEF-прогон: эликсир 93 и орб 99 надеваются
на пояс, иконки видны, leftover/merge/swap живут в PostgreSQL после reconnect.

- catalog v7: **93** (`bottles_live1_2712.png`, `pocketCntMax=1`) и **99**
  (`bottles_sila1.png`, `pocketCntMax=10`); starter в bag, пояс на login пустой;
- `user|pocket`: `capacity=4`, массив с `slot=67108864`, `slot_num` 1-based,
  `cnt`, `actions=16`, без `action:"bag"`;
- те же OA `PUT_ON`/`PUT_OFF`; pocket deny **`204`**; перчатка 9095 на пояс
  и DROP из pocket — `204`;
- unique `(hero_id, pocket_position)`; порт `listPocket`; fight consume — CMB-02;
- в бою PUT_ON/OFF/DROP/SELL — `FightRules` `203`. Трата из кармана не в срезе.

## Inventory USE — готово

Есть raw-AMF E2E и подтверждённый CEF-прогон: мясо 77 съедается из bag,
стек падает, `artifact_actions` ADD_HP на wire, reconnect совпадает с PostgreSQL.

- catalog v8: **77** (`rawmeat_grey.png`, type 10, `actions=7`, map `"20"`);
- OA `object_class=ARTIFACT` без `code` → `common|object:USE`;
- `ADD_HP` по каталогу (`param2=0` → % от hpMax), не хардкод id 77;
- полный HP всё равно consume; в бою и без action — `203`;
- 9095/93/99 без USE. DRINK / ADD_MP / `bonus_id` не в срезе.

## Inventory — частично

Не перенесены durability/repair, DRINK/TEMPEFFECT, ADD_MP. Добор пояса после
боя (`CMB-03`) есть: spent cells refill from bag to `pocketCntMax`.

## World presence — готово

Есть raw-AMF E2E: два изолированных героя видят друг друга в
`chat|area_population` (`id` = accountId); COME_IN/`exit`/logout дают `2:`
`area_population_diff`; каждый esrv poll несёт `131:<area>` `common|hunt`;
chat auth — пустое тело; restart очищает очередь и собирает roster из sessions.

- Roster: `identity.sessions` ⨝ `heroes.area_id`; delivery process-local;
- Long-poll wake per-account. `chat|add` и party `4:` не в срезе.

## World transitions — готово

Есть raw-AMF E2E и подтверждённый CEF-прогон: из 503 сайдбар ведёт в лавку
504 и ущелье 501, `common|exit` возвращает из лавки, таймер 15с на 501
соблюдается, reconnect на dest совпадает с PostgreSQL.

- `playable-slice/v10`: areas 501/503/504 и четыре travel `area_links`;
- OA `COME_IN` / `common|exit`; `heroes.move_ready_at`; overload 21/20 → 204;
- в бою travel `FightRules` `203`; нет ребра → `203` «некуда идти».

## World и hunt — частично

Есть published area/hunt content, transitions 503↔501/504, process-local
hunt overlay и map join: первый ATTACK_BOT **50310** ставит `fight_id` на
точке и в `131:`; второй клиент входит в тот же бой (`fight|conf` с тем же
`fightId`/`akey`, свой `userId`). Raw-AMF и CEF двумя клиентами.

Не перенесены authored wander/respawn (у 50310 в dump нет — не выдумывать)
и OA `FIGHT_JOIN` / `FIGHT_HELP`.

## Combat — частично

Есть hunt melee loop, CMB-02 casts, CMB-03 terminal settlement и CMB-04
reconnect/ghost/RESURRECT (raw-AMF): ATTACK_BOT → fproxy auth/bootstrap,
L/C/R, карман/перчатка/ярость, затем esrv один `2:` object `fight|loot`
затем `fight|exit`. Win 50310 пишет HP/EXP/money (overlay 0.2–0.44) и ролл
лута 77/93/99; loss пишет HP 0 + ghost/injury 875; `leaveFight` HTTP
`{rs:true}` и flee `type:2`. F5 mid-hunt: init2 `fight|conf` с тем же
`fightId`/`akey`, resume без `oppwait`, `attacknow` с остатком restTime.
Ghost блокирует regen; OA `RESURRECT` снимает ghost. Duplicate settlement
no-op. Restart посреди боя без награды. CEF экрана результата, F5 в бою
и призрака не прогонялся.

Не перенесены: OA `FIGHT_JOIN` / `FIGHT_HELP`.

## Quests и NPC 1–8 — не перенесено

Board, dialogs, book, goals, scripts, AREA waiting, quest fights, rewards,
markers и curated chain пока существуют только в legacy corpus.

## После core — не перенесено

Chat/party, полный store (ECO-02), mail, auction и trade рассматриваются
после цикла 1–8.

## Store — частично

Есть raw-AMF: COME_IN 504, `store|list` вкладка `-131` и лоты 23/24,
`store|buy` обоих (`25.00` → `23.00`, bag persist reconnect/restart). Отказы
status 2 и ghost 203 покрыты e2e. CEF лавки не прогонялся.

Не перенесены остальные лоты 504, diamonds, `store|repair`, OPEN_STORE.

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
