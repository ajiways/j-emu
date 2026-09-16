# Ручная проверка CEF

Список клиентских сценариев Wave 0–12, которые агент **не прогонял** в CEF
(Flash/Pub1 на `s1.jugger.ru`). Это отдельный операторский backlog уже
закрытых capability: вычёркивание строки поднимает product-status в
[CAPABILITIES.md](../CAPABILITIES.md), не сдвигает `ROADMAP.md`.

Исключение «Отложенный CEF Wave 5–12» **закрыто** (EDT-02). Новые capability
с production consumer нельзя закрывать без CEF. Проход строк ниже — Wave 0
→ 12, не вперемешку. Новый герой, штатные `npm run db:reset` / `start:https`,
без ручного patch БД. Контент менять HTTP `/operator/content/*` (не SQL).
После успешного клика вычеркни строку и подними product-status только
вместе с CEF-фактом в `CAPABILITIES.md`.

Выдача предмета и `money_minor` больше не требует патча БД: модуль
«Персонаж» в `j-content-editor` (CHAR-01) ходит в `/operator/hero/*`.
Нового героя без Flash создаёт `npm run dev:bootstrap-hero` против
запущенного `npm run dev` (печатает `heroId`).

## Character / бой

- [ ] CMB-03: экран результата hunt 50310 — HP/EXP/деньги/лут после
      `fight|exit`, HUD совпадает с PostgreSQL.
- [ ] CMB-04: F5 в активном hunt — тот же `fightId`/`akey`, без `oppwait`.
- [x] CMB-04: смерть → призрак, блок регена, OA `RESURRECT` снимает ghost
      и ставит HP `max(2, floor(hpMax*0.05))` в храме 503 (не в area смерти).
      CEF 2026-09-16. Dest 503 — временный outdoor stub
      ([WORLD.md](../modules/WORLD.md)).

## CEF 2026-09-16 leftovers (live Flash)

Очередь после HUD/Unity. Не новые CMB-id: дыры уже landed срезов.
Идём сверху вниз. После фикса — raw-AMF, затем повторный CEF; галочку
ставить только с CEF-фактом в `CAPABILITIES.md`.

- [x] CMB-04 leftover (CEF 2026-09-16): outdoor `RESURRECT` в храм 503
      «Горное поселение», не в локации смерти. Ghost `resurrect_zones` =
      `{503:{title}}`, пока призрак ещё стоит в 501. Хардкод 503 временный
      ([WORLD.md](../modules/WORLD.md) leftover dest).
- [x] INV-05 leftover: system chat `Вещи потеряли прочность: [[ARTIFACT_ITEM]] (-1).`
      после death/win break. CEF 2026-09-16: строка есть; цвет имени рисует
      клиент (`0` красный, `1–2` оранжевый); extra «полностью сломалась» в dump нет.
- [x] INV-05 leftover: после `store|repair` нельзя надеть, пока не открыть
      рюкзак — Flash не пересобирает PUT_ON на том же Artifact; esrv
      `user|bag_diff` `removed` затем `changed` с PUT_ON=8. CEF 2026-09-16.
      Сумки (SLOT_BAG / CAPACITY wear) не в срезе.
- [x] CMB-03 leftover: после боя кнопка инфо/экрана результата не открывает
      карточку — клик no-op. raw-AMF: OA `fight|finish` отдаёт `fight|info`
      с `share`/`macroses` SHARE (Flash SocialComponent). Лут/чат/exit после
      fproxy `fightFinish`. CEF 2026-09-16: карточка открывается.
- [ ] CMB-05 leftover: `hpChange` больше оставшегося HP (3 HP, удар 7).
      raw-AMF: wire `hpChange` = −min(raw, currentHP) на melee/kind-1/glove/DoT.
      CEF не подтверждён.
- [ ] INV leftover: в инвентаре и на надетой перчатке нет спеллов (и в бою
      панель пустая). raw-AMF: 9095 bag/view/`user|magic` несут catalog
      `hits` + expanded `spells`; PUT_ON отдаёт `user|magic`. CEF не
      подтверждён. Покупаемые/лутовые перчатки без catalog sockets и
      MAGRES/MAGSTR roll при grant — instance extra не персистится
      (`items.data_json` нет); см. [INVENTORY.md](../modules/INVENTORY.md).
- [ ] CMB-02 leftover: после «Разозлить» пропадает список спеллов перчатки
      (`persSpells`).
- [ ] CMB-08 leftover: после убийства текущего противника shuffle не даёт
      следующего (переключения нет).
- [ ] CMB-02 leftover: орб 99 — иконка не снимается после удара, висит
      мёртвым эффектом и блокирует похожие.
- [ ] CMB-06/15 leftover: плевок Хиссы — разовый урон, дебафф не вешается.
- [ ] CMB-01 leftover: в бою нет счётчика нанесённого урона (`dealtDamage`).
- [ ] CMB-01 leftover: пропуск хода вешает бой (нет таймера/`attacknow`).
- [ ] CMB-04 leftover: F5 в бою — иконки баффов/дебаффов без картинки
      (`persEff.img`).

- [ ] CMB-05: голый L1 vs Грызль **50310** — урон на полоске HP не
      константа 8–12; с перчаткой 9095 бой выигрывается.
- [ ] CMB-05: Ущелье 501, три dump-hunt — Хисса **50101** (STR 15), дух
      **50102** (STR 35), рыжий грызль **50103** (STR 45); разные удары,
      не копия Грызля.
- [ ] CMB-06: Хисса **50101** — плевок `magic_direct` вместо только
      `attack_center`; Грызль **50310** по-прежнему melee-only.
- [ ] CMB-08: два героя в 503 — propose/accept friendly duel, экран боя
      `is_pvp`, после выхода HP как до дуэли.
- [ ] CMB-08: второй охотник на Грызля 50310 — после трёх обменов ударов
      первый уходит в ожидание, второй получает бота, полоски HP те же.
- [ ] GEAR-01: герой L7, выдать и надеть 20546 «Изначальная мифическая
      перчатка тирана VI», ATTACK_BOT Грызль 50310 — иконка kind-3 на 8
      ходов, без прока на удар; F5 в бою сохраняет remaining; рестарт
      процесса снимает бой, перчатка остаётся в paperdoll. Выдать 20546:
      j-content-editor «Персонаж» → grant `artifactId` 20546.
- [ ] CMB-10: NPC 271, взять «Ростер ритуала», бой flags 8 (Хисса vs
      Грызль+дух), chat start/win; сдать; «Ритуал Грызля» остаётся на
      доске. Проигрыш оставляет квест started.
- [ ] CMB-11: JOIN `{team:2}` и HELP на цель team 2 входят в тот же
      `fightId` на 50310; карта ATTACK_BOT на занятый spawn остаётся
      team 1; две копии 542 изолируют JOIN; после смерти бота team-2
      бьёт team-1, loot team-2 без hunt EXP; restart процесса → JOIN
      204 stale.
- [ ] CMB-12: три героя на 50310 — A vs Грызль, B occupied ATTACK_BOT
      team 1, C JOIN `{team:2}` сразу vs B; A после пары всё ещё бьёт
      бота; 2-hero JOIN team 2 без B по-прежнему ждёт смерть бота.
- [ ] CMB-13: два героя team 1 на 50310 — A vs Грызль, B occupied
      ATTACK_BOT, «Разозлить» → две human↔bot дуэли; после трёх обменов
      на обеих парах cross-swap, полоски HP те же.
- [ ] CMB-14: голый L1 vs Грызль 50310 — на полоске видны dodge/block/crit
      (`react` 1/6/14), не только hit.
- [ ] CMB-15a: Хисса 50101 — instant kind-1 с MAGRES, не копия STR/10.
- [ ] CMB-15b: charging overlay (Хисса 397 / перчатка 181) — второе
      `hpChange` школы, в том числе после dodge/block.
- [ ] CMB-15c: tick DoT/HoT или summon 632, если bot есть в DATA-03.

## Inventory

- [ ] INV-05: мастерская 504, `store|repair` перчатки 9095 и кирасы 20;
      сломанная 0/N не надевается.
- [ ] INV-06: диалог заточки (кристаллы 553/1310/4603/11408/13224), успех и
      fail-roll consume. Выдать кристаллы: j-content-editor «Персонаж».
- [ ] INV-07: сет рекрута 47 — 4 вещи портрет, 5 вещей TEMPEFFECT 106.
      Выдать комплект: j-content-editor «Персонаж».
- [ ] INV-08: выдать и кликнуть USE **640** (хлеб/DRINK), **623** (книга),
      **2371**×2 → **55**, **584** → отказ NPC. Выдать: j-content-editor
      «Персонаж».
- [ ] Leftover Unity body: надеть стартовую 9095 — персонаж не голый в мире
      и в бою (`fight|conf.persSelf_body`); снять — снова
      `armor();head(0,0,8,152);skin()`. Иконки paperdoll уже закрыты CEF.

## Instance

- [ ] DNG-01: L3+ герой, 501 → «Мрачная пещера Огра» 542; `instance_conf`
      без progress, hunt огра, выход в 501 и повторный вход в ту же копию.
- [ ] DNG-02: L7+ в 541 → копи 654 (Хозяин копей); L10+ в 651 → усыпальница
      653; L12+ в 499 → усадьба 673. Родители в slice без walk от 503 —
      поставить area штатным travel, когда двери станут достижимы, не patch БД.
- [ ] DNG-03: L11+ 510 → «Поганая яма» 544; `instance_conf` с
      `progress_finish_value=7` / `progress_value=0`; убийство trash сдвигает
      bar; босс даёт монеты **5986**; огр 542 без `progress_*`, босс даёт
      **2371**. Shop 830 не этот срез.

## Battleground

- [ ] BG-01: два героя L6 и L7, `arena|list` Раскоп, `bg_request` add+confirm,
      телепорт 637/635, COME_IN 636, ATTACK по нику до 20 очков, `arena|bg_finish`
      и kick в 500.
- [ ] BG-01 leftover: invite TTL 120s → бан часа; F5 в комнате без RAM match
      выкидывает в 500.
- [ ] HERO-01: два героя L6 и L7, Раскоп до хотя бы одного PvP-финиша —
      героизм на финише/статах ненулевой, совпадает с формулой, F5 сохраняет
      накопительный honor; рестарт процесса во время матча роняет RAM счёт,
      honor на герое после commit остаётся.
- [ ] CMB-16: два героя L6/L7 Раскоп ATTACK, третий в той же копии 636
      JOIN `{team:1}` в тот же `fightId` (`is_pvp:1`, `can_leave:1`);
      HELP на цель team 2 сразу vs waiter; с мира — 204 другая локация;
      restart → 204 stale.
- [ ] CMB-17: два героя в 503 friendly duel до финиша →
      `arena|finished_fights` type 6 с обоими никами; фильтр type 6;
      другая локация пустая; F5/рестарт сохраняет строку; hunt type 1
      на той же доске.
- [ ] CMB-17 leftover: hunt 50310 → `arena|runned_fights` type 1, пока бой
      жив; после `fight|exit` строки нет; F5 в бою строка на месте;
      рестарт процесса очищает живую доску.
- [ ] CMB-17 leftover: `fight_info.php?fight_id=` в активном hunt открывает
      тестовую карточку с никами; после финиша та же id из history;
      неизвестный id — «Бой не найден». Live chrome не этот прогон.

## Book

- [ ] BOOK-01: победа над Грызлем 50310 → вкладка бестиария `win_cnt` 1,
      F5/рестарт сохраняет счётчик.
- [ ] BOOK-01: вход в пещеру огра 542 → книга инстансов active artikul `1`;
      после TTL строка blocked.

## Professions

- [ ] PRF-01: выдать Старатель 2 + Знаковед 6 → вкладка профессий два
      active слота; на L7 `max_profession_skill` 59; F5/рестарт.
- [ ] PRF-02: купить Имуро-Юи 3 (10 золота) → work farm 4 в локации 500 →
      после цикла лут 1720, repeat/revoke; upgrade 3→13; F5/рестарт.
- [ ] PRF-03: L7 + Знаковед 6; USE книги 1861 → рецепт 61; craft 1×1720 →
      10×1714; КД 35с; избранное; F5/рестарт.

## Quests

- [ ] QST-ENG-01: USE 584 → доска NPC 271; принять синтетический квест;
      buy/equip 23, сдать; dialog fight vs Грызль; AREA waiting на 503;
      F5/рестарт сохраняет курсор и цели.
- [ ] QST-ENG-02: AREA waiting на 503 → quest-fight vs Грызль на
      `action_finish`; loot-цель не переполняется hunt-дропом; F5/рестарт.
- [ ] DAY-01: USE 584 / NPC 271, взять и сдать ежедневку (flags 1), журнал с
      countdown до 06:00, quest_delete прячет строку; F5 сохраняет done;
      повторно взять нельзя до 06:00 MSK.
- [ ] QST-ENG-03: USE 584 → MAIN `flags:32` на 271; принять `q_engine_multi`
      → клиент закрывает NPC (`jump`), локация 503; надеть 23; победить
      fight; перчатка снята; сдать → репа Радвея 5 = 10. Secondary 272 —
      raw-AMF `ref=272`, клик по SWF не обязателен.
- [ ] QST-ENG-04: NPC 271, ритуал Грызля — leaveFight «нельзя выйти из боя»;
      копия 542 — тот же deny; 50310 — flee; AREA item 1 засада vs Грызль;
      DROP мяса 77 откатывает loot.

## World / economy / HUD

- [ ] Store CEF: лавка 504 вкладка оружия, лоты 23/24, покупка, отказ
      «недостаточно денег».
- [ ] QST-ENG-05: NPC 271 `q_engine_store` → лавка 504, витрина 23/24.
- [ ] Leftover TRD-02: два героя кладут вещь на стол обмена, рестарт
      процесса — оба видят вещи в bag, окна обмена нет. Сессию не
      восстанавливать.
- [ ] Репутация: экран `user|stats`, Радвей track 5, SUM 36.
- [ ] CMB-01 leftover: кнопки L/C/R после паузы, скрытие на свой удар.
- [ ] CMB-02 leftover: счётчики пояса 93/99, перчатки 9095, ярости.
- [x] Leftover HUD auto-refresh (CEF 2026-09-16, частично): после hunt
      HP/`hp_time` и деньги приходят на esrv вместе с `fight|loot`/`exit`;
      operator grant/money тоже пушит HUD. Полный CMB-03 экран результата —
      строка выше, не закрыта.

## Internal ports (нет production OA)

Не кликаются в CEF и не должны получать test OA:

- [ ] `grantExperience` — только через бой/будущий квест.
- [ ] `noteHp` / lazy regen — HUD `hp_time`; отдельной кнопки нет.
- [ ] `grantReputation` — consumer QST-ENG-03 turn-in; отдельной OA-кнопки
      нет (CEF — строка QST-ENG-03).

## Как дополнять

После закрытия capability без CEF добавь сюда одну строку: ID, что кликнуть,
какой контент/герой нужен. Не дублируй raw-AMF acceptance из модульных docs.
