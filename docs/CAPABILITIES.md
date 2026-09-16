# Возможности j-emu

Единственный продуктовый статус переноса. Архитектурные документы описывают
ограничения реализации, но не означают, что функция уже работает.

Статусы:

- **готово** — есть E2E и подтверждённый клиентский сценарий для generic
  случая механики (representative-выборка контента, не полный каталог —
  объём контента отдельно фиксирует `CONTENT_MATRIX.md`);
- **частично** — существует только часть старого сценария или только узкий
  захардкоженный частный случай без generic-правила;
- **не перенесено** — рабочее поведение есть только в `jgr-emu`;
- **вне scope** — исключено явно (`EXC-01`: клан, in-process playerbots), не
  «пока не входит в волну 1–8» — этой границы больше нет, см.
  [ROADMAP.md](migration/ROADMAP.md).

## Foundation — готово

- PostgreSQL + Drizzle и pre-baseline init migration;
- database-generated persistent IDs;
- versioned content drafts/releases/publication;
- Pub1 item corpus decoder (`npm run content:decode:items` →
  `content/pub1-items.generated.json`); Pub1 bot corpus decoder
  (`npm run content:decode:bots` → `content/bots.generated.json` /
  `bot-loot.generated.json` / `bot-spell-books.generated.json`);
  areas/links/hunt decoder (`npm run content:decode:areas` →
  `content/areas.generated.json` / `area-links.generated.json` /
  `hunt-spawns.generated.json`);
  stores/reputation/bonuses/USE decoder (`npm run content:decode:economy` →
  `content/store-types.generated.json` / `store-lots.generated.json` /
  `reputation-tracks.generated.json` / `bonuses.generated.json` /
  `use-scripts.generated.json`);
  professions decoder (`npm run content:decode:professions` →
  `content/assistant-types.generated.json` / `farm-resources.generated.json` /
  `area-farms.generated.json` / `craft-recipes.generated.json`);
  dungeon decoder (`npm run content:decode:dungeons` →
  `content/dungeons.generated.json`);
  `npm run db:reset` без `PUB1_DIR` поднимает полный корпус из committed
  `playable-slice.json` + generated files;
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

Есть persisted naked HP/MP/EXP/honor, skills и appearance, достаточные для HUD после
bootstrap. Internal `grantExperience` атомарно применяет DATA-01 L1–L14 curve,
переживает reconnect/restart и не имеет production OA/CEF consumer. Internal
`syncResources` / `noteHp` применяют lazy HP regen с `regen_at` и `hp_time`
без ticker и без CEF gate; `mp_time` остаётся HUD `0`. Internal `grantHonor`
(HERO-01) пишет `heroes.honor` с Раскопа: raw-AMF, reconnect/restart; CEF не
прогонялся.

Не перенесено:

- CEF confirmation of CMB-03 result screen / HP-EXP-bag after exit;
- CEF F5 mid-fight (raw-AMF CMB-04 есть; outdoor `RESURRECT` dest 503 —
  CEF 2026-09-16, dest пока хардкод);
- клиентский EXP grant через квест.

CEF leftover (2026-09-16, **частично**): HUD HP/`hp_time` и деньги обновляются
с esrv loot/exit и operator grant без лишнего OA. Outdoor `RESURRECT` dest
503 подтверждён (хардкод, [WORLD.md](modules/WORLD.md)). Это не закрывает
CMB-03 экран результата.

Equipment-derived `user|skills` / `hpMax` считаются из naked skills + надетых
предметов (перчатка 9095 даёт VIT+5). Без экипа HUD показывает naked L1.

## Inventory equipment — готово

Есть raw-AMF E2E и подтверждённый CEF-прогон: перчатка 9095 надевается,
иконка/статы карточки видны, paperdoll slot 32, bag освобождается, HUD stats
меняются. Unity-модель (`user|view.body` и `fight|conf.persSelf_body` из
catalog `f_body`) пересобирается на PUT_ON/OFF (raw-AMF); CEF 3D leftover.

- catalog projection и stable item instance IDs;
- starter 9095 в bag (`greyset5_lhand.png`, `artifact_skills`); v15 также
  20/21/26 в bag (не надеты);
- `PUT_ON`/`PUT_OFF` через `common|action` и `common|object`;
- occupancy displace, level/gender/type gates (`203` + `error`);
- согласованный flat bag/view/pocket/skills/unitframe/conf/state;
- equipment vitals на mutation, bootstrap и reconnect/restart.

## Inventory bag DROP — готово

Есть raw-AMF E2E и подтверждённый CEF-прогон throw-away 9095: деньги остаются
`25.00`, reconnect совпадает с PostgreSQL. После INV-05 стартовый bag не
пустеет от DROP одной перчатки.

- catalog v6: `priceMinor`/`flags`/`bagStack` на 9095 (`0`/`40`/`1`);
- `user|bag.amount` считает только взвешенные слоты; starter v17 —
  `amount=6` / `total=12` (обычный кристалл **1310** `flags=0` входит в
  amount; остальные кристаллы заточки noweight); `amount_max=20`;
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

- catalog v8: **77** (`rawmeat_grey.png`, type 10, `actions=7`, map `"5"` —
  `row.id` из `artifact_artikul_77.amf`, `DATA-02`; старый handwritten
  slice держал `"20"` без AMF evidence);
- OA `object_class=ARTIFACT` без `code` → `common|object:USE`;
- `ADD_HP` по каталогу (`param2=0` → % от hpMax), не хардкод id 77;
- полный HP всё равно consume; в бою и без action — `203`;
- 9095/93/99 без USE. DRINK 640, skill book 623, consume/grant 2371 и NPC 584
  есть в v17; CEF выдачи предметов нет.

## Inventory — частично

Есть raw-AMF и PostgreSQL: instance `durability`/`durability_max`, смерть на
hunt −1 по 4–5 надетым tracking, `0/N` auto PUT_OFF, PUT_ON broken **204**,
`store|repair` finite `(max−1)/(max−1)` (9095 бесплатно 2/2, кираса 20 за
0.02g), persist reconnect/restart, concurrent repair — один победитель.
CEF мастерской не прогонялся.

Заточка (INV-06) workflow `done`, product **частично**: OA `UPGRADE`, overlay
на том же `items.id`, кристаллы **553 / 1310 / 4603 / 11408 / 13224**, шесть
ступеней type 3, резонатор на той же ступени, type 4 nested `203`, fail-roll
коммитит consume. CEF диалога заточки отложен до редактора контента.

Сеты (INV-07) workflow `done`, product **частично**: PUT_ON пяти вещей
рекрута 47 вешает TEMPEFFECT **106**, с 4 вещей overlay портрета,
trend 1+3 → **204**. CEF сетов отложен до редактора.

USE pipeline (INV-08) workflow `done`, product **частично**: DRINK **640** →
TEMPEFFECT, книга **623**/бонус **601** → `AGRILKA_MOBOV`, сборка **2371**×2 →
**55**, `NPC` **584** → `203`. ADD_MP — dispatcher без предмета в срезе.
CEF отложен до редактора выдачи предметов.

Добор пояса после боя (`CMB-03`) есть: spent cells refill from bag to
`pocketCntMax`.

## World presence — готово

Есть raw-AMF E2E: два изолированных героя видят друг друга в
`chat|area_population` (`id` = accountId); COME_IN/`exit`/logout дают `2:`
`area_population_diff`; каждый esrv poll несёт `131:<area>` `common|hunt`;
chat auth — пустое тело; restart очищает очередь и собирает roster из sessions.

- Roster: `identity.sessions` ⨝ `heroes.area_id`; delivery process-local;
- Long-poll wake per-account. Party `4:<id>` — SOC-02. `chat|add` — SOC-01.

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

CMB-13: на 50310 «Разозлить» клонирует бота, две human↔bot дуэли, 3↔3
cross-swap без сброса HP. CMB-12: opener↔bot и team-1↔team-2
параллельно. CMB-14: melee dodge/block/crit/DEF (`react` 1/2/6/10/14).
CMB-15: MAGSTR/MAGRES snapshot, kind-1 overlay, ticks/stun/dispel;
kind 10 summon 632 сжигается без clone. Wander: 50310 паркуется на
home (в dump нет route/zone); 50309 идёт по dump-proven route, 50101–03 —
по zone.

## Combat — частично

Есть hunt melee loop, CMB-02 casts, CMB-03 terminal settlement, CMB-04
reconnect/ghost/RESURRECT, CMB-05 STR-формула урона, CMB-06 bot spell
book и CMB-07 generic weighted loot (raw-AMF): ATTACK_BOT →
fproxy auth/bootstrap, L/C/R, карман/перчатка/ярость, затем esrv один `2:`
object `fight|loot` затем `fight|exit`. Melee damage = `STR/10 ±15%`
(`legacy behavior`), не dice 8–12/2–4. Бот с книгой кастует по книге
(Hissa 50101 `magic_direct`); Грызль без книги остаётся melee-only. Win
50310 пишет HP/EXP/money
(overlay 0.2–0.44) и ролл лута 77/93/99 (NOTHING доминирует; forced-roll
отдаёт 77); loss пишет HP 0 + ghost/injury 875;
`leaveFight` HTTP `{rs:true}` и flee `type:2`. Representative боты 2/4/24/32
и hunts 50310/50309/50101–50103. F5 mid-hunt: init2 `fight|conf` с тем же
`fightId`/`akey`, resume без `oppwait`, `attacknow` с остатком restTime.
Ghost блокирует regen; OA `RESURRECT` снимает ghost и outdoor уносит в
храм 503 (CEF 2026-09-16; dest — временный stub,
[WORLD.md](modules/WORLD.md)). Duplicate settlement
no-op. Restart посреди боя без награды. CMB-08: OA
`user|friendly_duel_propose`/`accept` между двумя героями в 503 (esrv
request, `fight|conf` `is_pvp:1` `type:6`, practice restore); hunt 3↔3
waiter-handoff без сброса HP. GEAR-01: надетая **20546** на старт hunt
вешает kind-3 (`persEff` затем `effUse`, `groupId` 936, 8 ходов), без
прока; `effPurge` на 8-м ударе; F5 в том же процессе сохраняет remaining;
restart снимает бой, перчатка остаётся в paperdoll. CMB-10: dialog
`q_engine_roster` поднимает quest-бой flags `"8"` (герой+Хисса vs Грызль и
дух), `chat_*`, `win_fight` без bump kill на `q_engine_fight`; проигрыш
оставляет book 5 started; mid-fight restart рвёт RAM. CEF экрана результата,
F5 в бою, видимого урона, плевка Хиссы, дуэли, gear-spell и
quest roster flags 8 не прогонялся. Outdoor `RESURRECT` dest 503 —
CEF 2026-09-16. CEF leftovers (поломка без чата, экран результата,
overkill, aggro/спеллы, shuffle, орб/дебаффы, dealtDamage, skip-turn,
F5 img) — [CEF_MANUAL.md](migration/CEF_MANUAL.md).
CMB-11: OA `FIGHT_JOIN` `{team:1|2}` и `FIGHT_HELP` входят в тот же RAM
`fightId` на 50310; карта ATTACK_BOT на занятый spawn остаётся team 1;
две копии 542 изолируют JOIN; после смерти бота живой team-2 продолжает
vs team-1 без hunt EXP; restart → 204 stale. CMB-12: три героя на 50310 —
JOIN `{team:2}` сразу human↔human, opener продолжает vs Грызля. CMB-16:
тот же OA входит в живой PvP Раскопа same-copy; world JOIN — 204 другая
локация; friendly JOIN — дуэль. CEF join/intervene/Раскоп JOIN не
прогонялся.

Не перенесены: outdoor `ATTACK`
challenge (CMB-18, только после явного решения — в jgr runtime этого нет);
kind 10 summon clone в roster. Hunt N×N две дуэли на 50310 landed
(CMB-12). Aggro clone + 3↔3 cross-swap landed (CMB-13). Melee
outcomes (CMB-14) и magic 15a–c landed. BG `FIGHT_JOIN` landed (CMB-16).
OA `arena|finished_fights` и practice type 6 history landed (CMB-17).
OA `arena|runned_fights` (живая доска area, RAM) и тестовый
`/fight_info.php` landed. Live chrome карточки и PvP type 1 history —
leftover. CEF боя не прогонялся.

## Quests и NPC — частично

Есть raw-AMF и PostgreSQL: NPC 271 (Голова мертвеца, 503 item **4**) и
NPC 272 (вторичная доска, item **8**); восемь синтетических квестов
(`q_engine_board` / `q_engine_fight` / `q_engine_area` /
`q_engine_daily` / `q_engine_roster` / `q_engine_multi` /
`q_engine_ambush` / `q_engine_store`). USE 584 открывает
доску 271 без consume (`npc|info` + `npc|quests`). `npc|answer` двигает
курсор; dialog `START_FIGHT` `mode:"quest"` vs Грызль (bot 2). Цели
talk/kill/loot/buy/equip/deliver/area_action/win_fight; скрипты `GRANT_*` /
`REMOVE_ARTIKUL` (bag или paperdoll) / `MSG` / `SET_FLAG` / `JUMP_AREA` /
`OPEN_STORE` / waiting AREA. `q_engine_multi`: MAIN `flags:32`, secondary `active_only` на
272, talk только с целевого NPC, accept `{ jump:"area", macros_list:[] }`
без смены area, turn-in `awardRep` track **5** +10. `book|quest_list` /
`quest_targets` / `quest_counters` только `currentGoal`. AREA
`common|waiting` → `action_finish` с leftover `START_FIGHT` и piggyback
`fight|conf`. Hunt loot-cap через quests-port `needed`. `area_conf` offer
href только NPC-доска / AREA hotspot. DAY-01: ежедневка `flags:1` один раз
за круг до 06:00 MSK, lazy wipe на OA, журнал `multitime:1` / countdown,
`book|quest_delete` прячет done, cycle-aware EXP; reconnect/restart до
границы. QST-ENG-04: `leaveFight` в quest/copy — `{rs:false,
err:"нельзя выйти из боя"}`, бой жив; outdoor hunt 50310 — flee; AREA
ambush без `mode:"quest"` стартует hunt-бой и бампает клик сразу; chance
miss без `fight|conf`; DROP 77 при loot 1/1 → `done=0`. QST-ENG-05:
player `OPEN_STORE` на `q_engine_store` — `npc|answer` `{jump:"area"}`,
герой в 504, следующий `store|list` type `-131` лоты 23/24; `JUMP_AREA`
без OPEN_STORE area не меняет. Cursor, goals,
facts, waiting, done, hidden, репа и bag/paperdoll переживают
reconnect/restart. CEF доски NPC 271, buy/equip 23, dialog-боя,
AREA waiting на 503, quest-fight на `action_finish`, loot-cap, ежедневки,
roster flags 8, QST-ENG-03 (MAIN + jump + репа), QST-ENG-04 (deny leave /
ambush / QL-2) и QST-ENG-05 (лавка из диалога) не прогонялся —
[CEF_MANUAL.md](migration/CEF_MANUAL.md).

Не перенесены куратский Акрилон, полный NPC corpus, данж `256`/`257`,
MAIN `33`, live 75/276, `daily_pvp_kills` / stats 49, ложь
`mergeFinishedQuestsForMapMarkers`.

## Mail — частично

Есть raw-AMF: `post|list` кладёт restart-safe welcome от «Почтальона»,
`post|list_sent`, `post|send` / `send_cod` (postage, золото, вложения),
`post|pick` / `batch_pick` / `retract` / `delete`, no-op `post|read`,
`user|bag_order`, `state.new_message` из unread inbox, macros `[[USER key]]`,
TTL sweep на list и DelayScheduler. Dual-hero send/pick переживает
reconnect/restart; pick выдаёт новый `items.id`. CEF почты не прогонялся.

Не перенесены system chat о письме и кланы.

## Auction — частично

Есть raw-AMF: `auction|lot` / `my_lot` / `my_bid` / `min_price`,
`lot_add`, `bid`, `buyout`, `cancel`, `tenders` / `my_tenders`,
`tender_add`, `tender_sell`, `tender_cancel`, TTL sweep на list и
DelayScheduler. Buyout/bid/fill/expiry гонки — один победитель; settlement
через системную почту переживает reconnect/restart. CEF аукциона не прогонялся.

Не перенесены `addToLot` и playerbots.

## Trade — частично

Есть raw-AMF: `trade|request` / `confirm` / `put` / `put_money` / `withdraw`,
`session_ready` / `session_decline` / `session_confirm` / `decline`. Инвайт
esrv `common|window` на `2:`; сессия process-local через disconnect; settle
в одной UoW списывает налог и меняет bag/деньги. Restart процесса возвращает
вещи со стола в bag (escrow `held_items`, новый `items.id`); сессию не
persist. CEF окна обмена не прогонялся.

Не перенесены persist сессии обмена (сознательно leftover TRD-02: окно не
переживает рестарт процесса).

## Chat — частично

Есть raw-AMF: `chat|add` area/private/system, dump stub echo + `state`, fan-out
соседям на `2:` отдельными `chat|message` кадрами. Hunt start/end и loot/money
system-строки после UoW settlement; сбой enqueue не откатывает награды.
`trade|confirm` шлёт «согласился торговать». Party type — на `4:` при
membership (SOC-02). CEF чата не прогонялся.

Не перенесены кланы, one-fight TEMPEFFECT expiry chat, quest announce.

## Party — частично

Есть raw-AMF и PostgreSQL: create/invite/confirm/decline/kick/leave/disband,
change_leader (level ≥), save_settings (bag-lock `loot_rules`),
search_list/join/`join_confirm`, `party|give`/`drop`, TTL 3h bag,
outdoor loot rules 1–3 + `fight|grouploot` на `4:`, `FIGHT_JOIN`/`FIGHT_HELP`
same-area/same-copy team 1|2, HELP ACTION в party chat, `state.party` из membership,
init2 restore members/settings/bag. Reconnect/restart читает Postgres.
CEF окна группы не прогонялся.

Не перенесены dungeon bind warning на invite, dungeon lottery rules 1, quest personal_only.
Hunt parallel duels after intervene — CMB-12.

## Instance — частично

Есть raw-AMF и PostgreSQL: COME_IN 542 ogre cave (artikul `1`) и remaining
`has_clear: false` копи/усыпальница/усадьба (11/12/14) создают copy,
auto-party, `common|instance_conf` без `progress_*`, `state.instance=1`,
per-copy hunt id (route или zone), bind на exit/re-enter, presence isolation
двух копий, kill без respawn (ogre), TTL kick на parent, expired bind status
`2`. Яма artikul `2`/544: `has_clear` bar `progress_finish_value:"7"`,
`progress_value` tick, монеты **5986** с босса (итог формулы, `personal_only`),
огр **2371** `personal_guaranteed` каждому team-1. POST-03: тот же engine на
8 documents из `dungeons.generated.json`, включая `has_clear` Провал `4`/548
finish 9, Норы `6`/586 finish 7, Хардиф `7`/617 finish 12. Combat
`fight|conf.instance_id` = copy id, `can_leave:0`. Restart читает copy/bind и
killed spawns. `book|instances` active/blocked по bind+expiry.
`book|bestiary_info` — `hero_bot_kills` после hunt win (Грызль 2). CEF книги
и ямы не прогонялся.

Не перенесены `loot.bands`, dungeon shops, abort fight on expiry,
daily 06:00 MSK wipe.

## Battlegrounds — частично

Есть raw-AMF и PostgreSQL: `arena|list` / `bg_request` add+confirm для
Раскопа `general|2` (L6–L7), isolated `copy_type='bg'` (rooms 635/636/637),
`ATTACK` PvP `is_pvp:1` `type:"1"` `flags:"128"` до 20 очков, ordered
`arena|bg_finish`, typed `battleground.finished_*`, kick в 500. Restart
роняет RAM queue/match и выкидывает orphan из комнат на `common|init`.
Deny очереди status **2**. HERO-01: финиш PvP-боя Раскопа начисляет сырой
героизм один раз (`round(Base×dmg/hpMax×1.4|0.8)`), live/finish
`user_stats.honor` — сумма боёв, unitframe/conf/stats — накопительный
`honorProgress`; hunt и friendly duel не двигают honor. CEF Раскопа и
героизма не прогонялся — [CEF_MANUAL.md](migration/CEF_MANUAL.md).

Не перенесены fairness seal (8668), остальные BG-карты (POST-04),
slaughter/fortress/companion, заполнение `arena|leader_rating`, overlay
EXP на stats, `level_penalty` / казнь / короны.

## После core — не перенесено

DATA-06 NPC/диалоги/куратские квесты (низкий приоритет, не `next`).

## Store — частично

Есть raw-AMF: COME_IN 504, `store|list` вкладка `-131` и лоты 23/24,
`store|buy` обоих (`25.00` → `23.00`, bag persist reconnect/restart). Generic
pay/gate: gold / diamond / barter по `artikul_id` инстанса, RANK/REPUTATION/LEVEL
на лоте. Арсенал 552 lot 438 / artikul 621 — list + buy RANK 203 `Нужно
звание «Громила».`. Отказы status 2, gate 203 и ghost 203 `storeBuy` покрыты
e2e. `store|repair` instance `{ id }` чинит finite item (ghost не блокирует;
cost 0 не зовёт `debitMoney`). QST-ENG-05: dialog `OPEN_STORE` штатный ComeIn
в 504 + `jump:"area"`, без piggyback `store|list`. CEF лавки и мастерской не
прогонялся. DATA-05: 23 store dumps (113 types / 2095 lots) из
`content/store-*.generated.json`.

Не перенесены diamond JSON conversion 1:900, extra badge SKUs на wire,
COME_IN LEVEL entry, `badge_data` в `store|list`.

## Reputation — частично

Есть raw-AMF и PostgreSQL: OA `user|stats` named rows (опыт/героизм, нули
kill/duel/fatality/daily, type:2 только при value > 0, всегда SUM 36 type 3),
`grantReputation` track **5** persist reconnect/restart. Catalog публикует
22 type-2 трека (Радвей **5** empty unlock; 7/11/… с `unlockFlag`). Квестовый
consumer — `q_engine_multi` turn-in
(`GRANT_AWARDS` → track 5 +10). CEF экрана репутации и сдачи
`q_engine_multi` не прогонялся — [CEF_MANUAL.md](migration/CEF_MANUAL.md).

Не перенесены kill overlay, SET_FLAG unlock grant, chat notify, GRANT_REP.

## Professions — частично

Есть raw-AMF и PostgreSQL: каталог Старатель **2** + Знаковед **6**,
`learnProfession` value 1, `user|professions` 16 слотов и кап с 7 ур. (59),
`common|conf.profession_info` только эти id; ассистент **3** (create 10
золота), farm **4** на area **500**, sweeper finish, loot **1720**,
repeat/revoke, upgrade **3→13**; рецепт **61**, USE книги **1861**,
craft **1720→1714×10**, cooldown 35с, избранное. Reconnect/restart читает
Postgres. CEF вкладки профессий и гремлинов не прогонялся; квестового GRANT нет.

Не перенесены ids 1/3/4/5/7–16, смена лицензии, cooking/`craft|cook_list`,
voodoo-ассистенты, climate rotation. POST-02: 45 assistants / 83 farms /
86 spots / 266 type-1 recipes из generated JSON.

## Content editor — частично

Есть HTTP JSON `/operator/content/*` (Bearer `CONTENT_OPERATOR_TOKEN`):
`saveDraft` / candidate / validate / activate, GET `document` / `keys` из
active release (не из `playable-slice.json`). Representative EDT-01: title
NPC 271, USE 584 `npc|info`. EDT-02: один candidate, шесть overlays
(`store_lot` `504:80`, `dungeon` `1`, `craft_recipe` `61`, `battleground`
`general|2`, `artifact` `20546`, `use_script` `2827`) → OA
`store|list` / dungeon title / craft list / `arena|list` / bag title 20546 /
USE 2827 failPlaque; restart GET совпадает; 422 не двигает pointer. CEF
Flash-редактора нет. Исключение «Отложенный CEF Wave 5–12» закрыто.

EDT-03: HTTP JSON `/operator/hero/*` (тот же Bearer): GET bag/pocket/
paperdoll/`moneyMinor`/`exp`; POST item (`artifactId`/`quantity`); POST
money (знак `minorUnits` = credit/debit `money_minor`). 401/400/404/409
без fallback. Restart сохраняет bag и золотые монеты (`money_minor`).
Flash/OA consumer нет
(internal enabling, product **частично**). `ExperienceGrantService` и
алмазы не входят. Визуальная консоль — соседний репозиторий
`j-content-editor` (CHAR-01), не SPA внутри j-emu.

EDT-04: HTTP JSON `/operator/catalog/artifacts` (тот же Bearer): поиск
`?q=` / пакет `?ids=` / GET `:id` → `{ id, title, picture, kindId, typeId }`.
Иконки — статика Pub1 `/images/data/artifacts/{picture}`. Flavor-описание
артикула в проекции нет. 401/400/404 без fallback.

Не перенесены SPA `/dev/content`, rollback/export, `operator_roles`,
DATA-06 mass import, новые ключи вне active
release.

## Вне первой волны

Achievements, info pages. Проход `CEF_MANUAL` Wave 0–12 — отдельный
операторский backlog, не запись очереди.

Clan и встроенные playerbots не переносятся.

## Как менять статус

Статус повышается только вместе с:

1. адаптированным модульным контрактом;
2. raw-AMF/Fastify/PostgreSQL E2E;
3. проверкой persistence/reconnect, если она требуется сценарию;
4. успешным сценарием в реальном клиенте для статуса **готово**.

Источник старых возможностей:
[jgr-emu CAPABILITIES.md](../../jgr-emu/docs/CAPABILITIES.md).
