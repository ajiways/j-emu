# Character и bootstrap

## Статус

Перенесены cold login и reconnect bootstrap: полный flat `common|init` /
`common|init2`, persisted HP/MP/EXP/appearance/skills и game-wide chrome из
active content release. Inventory mutations, world transitions, combat
mechanics и quests в этот срез не входят. Точный статус:
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
- VIT в policy обязан равняться `maxHp`, MPMAX — `maxMp` (этот срез не считает
  экип);
- tutorial flags пишутся в `hero_personal_details` при создании и больше не
  overlay-ятся на чтении.

Player state:

- HP/MP/EXP, money/diamonds, kind, body, skills и personal details живут в
  PostgreSQL;
- EXP/honor/bag_cnt/avatars читаются из active catalog (`level_boundaries`,
  `appearance_presets`, `hud_defaults`);
- `common|conf` и empty chrome (professions/pets/friends/bank/…) читаются из
  `catalog.game_wide_documents`.

Out of scope here: PUT_ON, area travel, fight resume, party, mail, presence
roster и quest book contents.

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
- статус **готово** в CAPABILITIES требует подтверждённый сценарий в реальном
  клиенте.
