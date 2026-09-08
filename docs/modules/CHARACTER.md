# Character и bootstrap

## Статус

Bootstrap закрыт: raw-AMF E2E и реальный CEF smoke-test показывают HUD и
локацию после cold login. Character progression (regen, level-up) ещё
частичный. Equipment-derived VIT/hpMax считаются после PUT_ON; без экипа HUD
показывает naked L1 (VIT 10). Inventory mutations, world transitions, combat
mechanics и quests в bootstrap-срез не входят. Точный статус:
[CAPABILITIES.md](../CAPABILITIES.md).

## Источники поведения

- `jgr-emu/docs/PROTOCOL.md`;
- `jgr-emu/docs/CHARACTER_STATS.md`;
- `jgr-emu/docs/HP_REGEN.md`;
- `jgr-emu/src/bootstrap.ts`, `heroBuilder.ts`, `gameConfig.ts`, `stats.ts`.

Рабочий jgr-emu bootstrap переносится целиком как behavioral baseline. Отдельный
wire research нужен только при расхождении старого ответа с клиентом.

## Контракт

`common|init` и `common|init2` — flat responses. State, bag, pocket, magic,
skills, conf, personal details, book trio, unitframe, chat, area и chrome-блоки
являются соседями верхнего уровня.

Hero identity:

- `heroes.id` — numeric PostgreSQL identity и `user|conf.id`;
- starter HP/MP/EXP, body, kind/gender/language, honor и skills приходят из
  versioned `HeroCreationPolicy`;
- VIT в policy обязан равняться naked `maxHp`, MPMAX — naked `maxMp`;
- equipment totals (`user|skills`, `hpMax`) считаются из naked + надетых
  `artifact_skills` на PUT_ON/OFF и при чтении skills;
- tutorial flags пишутся в `hero_personal_details` при создании и больше не
  overlay-ятся на чтении.

Player state:

- HP/MP/EXP, money/diamonds, kind, body, skills и personal details живут в
  PostgreSQL;
- EXP/honor/bag_cnt/avatars читаются из active catalog (`level_boundaries`,
  `appearance_presets`, `hud_defaults`);
- `common|conf` и empty chrome (professions/pets/friends/bank/…) читаются из
  `catalog.game_wide_documents`.

Out of scope here: area travel, fight resume, party, mail, presence roster и
quest book contents. Paperdoll `PUT_ON`/`PUT_OFF` — [INVENTORY.md](INVENTORY.md).

## Persistence

Account, hero, personal details и `hero_skills` находятся в PostgreSQL.
Registration/dev-slot создаёт hero+skills+tutorial details+starter inventory в
одной Unit of Work. Reconnect и process restart строят bootstrap из БД.

## Acceptance

- raw-AMF E2E покрывает полный init/init2 inventory, skills, HUD numbers и
  restart;
- money — строка в `state`, число в `user|conf`; `money_gold` — алмазы;
- отсутствующий обязательный catalog/hero block не маскируется пустым
  `status:100`;
- bootstrap **готово** в CAPABILITIES подтверждён CEF HUD/location smoke-test;
  character progression остаётся частичной. Equipment totals проверяются E2E
  PUT_ON, не CEF-прогоном.
