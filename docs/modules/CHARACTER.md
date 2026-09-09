# Character и bootstrap

## Статус

Bootstrap закрыт: raw-AMF E2E и реальный CEF smoke-test показывают HUD и
локацию после cold login. CHR-01 `grantExperience` реализован как internal
port: EXP/level и managed skills пишутся в PostgreSQL, raw-AMF init/init2
показывают final boundary после reconnect/restart. Клиентского OA и CEF
level-up нет до квестов, поэтому character progression остаётся
частичным. CHR-02 lazy HP regen реализован как internal ports `syncResources` /
`noteHp`: wounded HP начисляется с `regen_at` на resource reads и мутациях,
`hp_time` уходит в `user|unitframe`. CMB-03 пишет fight HP/EXP через эти
порты (raw-AMF). Honor и ghost/injury не входят. CMB-03 loss пишет HP `0` без ghost: до
CMB-04 CHR-02 regen может заживить труп после ненулевого elapsed. Equipment-derived VIT/hpMax
считаются после PUT_ON; без экипа HUD показывает naked L1 (VIT 10). Точный
статус: [CAPABILITIES.md](../CAPABILITIES.md).

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
- starter EXP 1, body, kind/gender/language, honor и misc skills приходят из
  versioned `HeroCreationPolicy`;
- L1 level, naked VIT/MPMAX, current/max HP/MP и шесть managed skills читаются
  из transaction-pinned progression snapshot;
- equipment totals (`user|skills`, `hpMax`) считаются из naked + надетых
  `artifact_skills` на PUT_ON/OFF и при чтении skills;
- tutorial flags пишутся в `hero_personal_details` при создании и больше не
  overlay-ятся на чтении;
- `use_fproxy: 1` форсируется на каждом wire-чтении `user|personal_details.info`
  (live `heroBuilder`). Без него CEF шлёт fight auth на TCP `:33120`, а не на
  HTTPS `/fproxy/`. Поле не хранится в Postgres и не является tutorial overlay.

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

## CHR-01 — EXP и level progression

### Architecture decision

Отдельный `ARC-CHAR` не нужен. Authoritative `exp`, `level`, текущие HP/MP и
maxima уже принадлежат character; naked skills принадлежат тому же модулю.
Catalog поставляет immutable authored progression, а inventory — только
read-only snapshot модификаторов надетых предметов. Character не импортирует
combat/quest и не знает источник будущей награды.

Публичная application operation принимает typed command:

- `characterId` — положительный PostgreSQL/wire identity;
- `operationId` — обязательный стабильный idempotency key источника по
  `^[A-Za-z][A-Za-z0-9_-]{0,31}:[A-Za-z0-9][A-Za-z0-9:._-]{0,94}$`;
- `amount` — положительный integer; нулевой и отрицательный grant не являются
  no-op.

Результат содержит previous/final EXP и level, число полученных уровней и digest
progression release. Повтор `(characterId, operationId)` с теми же входными
данными возвращает сохранённый результат без повторной мутации. Повтор ключа с
другим amount — диагностируемый conflict. Источник обязан namespace-ить
`operationId`; character не принимает generic source payload и не интерпретирует
combat/quest identity.

Обязательные public contracts:

- exported character progression port:
  `grantExperience(command): Promise<ExperienceGrantResult>`;
- catalog progression port: один
  `progressionSnapshot(): Promise<ProgressionSnapshot>` с content release ID,
  progression digest, ordered boundaries и managed values;
- inventory equipment port:
  `modifiersForHero(characterId, releaseId)`; он читает item instances и
  artifact definitions именно указанной immutable release;
- Unit of Work принадлежит progression application service. Character
  repositories и оба injected read ports используют его текущую PostgreSQL
  transaction.

`ExperienceGrantResult` содержит `expBefore`, `expAfter`, `levelBefore`,
`levelAfter`, `levelsGained`, `contentReleaseId` и `progressionDigest`.
Public failures:

- `CharacterNotFoundError` — hero отсутствует;
- `InvalidExperienceGrantError` — malformed identity/key, non-positive amount
  или integer/wire overflow;
- `ExperienceGrantConflictError` — reuse ключа с другим amount;
- `CharacterProgressionStateError` — stored level/EXP/managed skills
  противоречат опубликованному snapshot;
- `ProgressionContentError` — active curve/skill definitions отсутствуют или
  невалидны;
- `ProgressionLimitError` — final EXP выходит за опубликованную curve.

Они не превращаются в success. Private class/file layout остаётся решением
coding agent; каждый public error class следует правилу one-major-type-per-file.

### Progression content

Level curve читается одним snapshot из одной active release. Нельзя делать
последовательные lookup, способные смешать две release. Projection содержит:

- непрерывные boundaries начиная с L1 `expMin=0`;
- `expMax(level N) == expMin(level N+1)`;
- одинаковый полный набор progression-managed naked skills для каждого уровня:
  `STR`, `RAG`, `DEX`, `DEF`, `VIT`, `MPMAX`;
- provenance и digest исходного набора.

Managed skill values — нормализованные строки catalog projection, а не поля
presentation-only `skill_definitions` и не runtime-формула. L1–L6 подтверждены
live gear-subtract evidence. Значения выше L6, пока нет более сильного дампа,
маркируются `legacy behavior / extrapolated`, а не выдаются за live truth.
Publication отклоняет gap, overlap, неизвестный skill, разный managed set,
нецелое/отрицательное значение и неположительные VIT/MPMAX.
`progressionDigest` детерминированно покрывает ordered boundaries и managed
values, но не unrelated content той же release. После первой DATA-01 activation
CHR-01 разрешает последующим release только тот же progression digest; изменение
curve требует отдельной capability с player-state migration и не может
активироваться как обычная content edit.

Та же activation compatibility защищает equipment-derived maxima: artifact ID,
который уже был в предыдущей active release, нельзя удалить или изменить его
stat-affecting skills. Новые artifact IDs добавлять можно. Изменение существующих
skill semantics требует отдельной migration/recalculation capability.
Progression operation читает pointer один раз, а progression и equipment
modifiers — по сохранённому release ID; поэтому concurrent activation не
смешивает данные двух release.

Нормализованный DATA-01 core:

| Level | EXP interval     | STR | RAG | DEX | DEF | VIT | MPMAX |
| ----: | ---------------- | --: | --: | --: | --: | --: | ----: |
|     1 | `[0, 68)`        |  12 |   8 |   8 |   8 |  10 |    12 |
|     2 | `[68, 203)`      |  13 |   9 |   9 |   9 |  11 |    13 |
|     3 | `[203, 473)`     |  14 |  10 |  10 |  10 |  12 |    14 |
|     4 | `[473, 1013)`    |  16 |  11 |  11 |  11 |  13 |    16 |
|     5 | `[1013, 1823)`   |  17 |  12 |  12 |  12 |  14 |    17 |
|     6 | `[1823, 3623)`   |  19 |  13 |  13 |  13 |  16 |    19 |
|     7 | `[3623, 10373)`  |  20 |  14 |  14 |  14 |  17 |    20 |
|     8 | `[10373, 23873)` |  21 |  15 |  15 |  15 |  18 |    21 |

L1–L6 skill values — confirmed gear-subtract evidence; L7–L8 — точный результат
legacy `COMBAT_BASE_GROWTH`, provenance `legacy behavior / extrapolated`.
`bagCnt=2` для всех core rows. `expMin <= exp < expMax`; поэтому creation EXP 1
валиден на L1, а `23873` — первый unsupported EXP и должен fail whole grant.

Hero creation читает L1 из transaction-pinned snapshot, а не из startup-fixed
managed values. После CHR-01 creation policy хранит обязательный initial EXP 1
и non-progression settings/misc skills; level, naked VIT/MPMAX, max/current
HP/MP и шесть managed skills берутся из L1. Fresh hero начинает с полными naked
HP/MP. Старые duplicated `level`, `hp/maxHp`, `mp/maxMp` и managed skills
удаляются из config schema в этой capability, а не сравниваются при каждом
старте. Grant, выходящий за опубликованную curve, отклоняется целиком: clamping
level/EXP запрещён.

### Transaction and calculation

Одна Unit of Work:

1. блокирует hero row по `characterId`;
2. ищет persisted operation result; matching amount сразу возвращает
   сохранённый result без чтения current curve/hero state, другой amount даёт
   conflict;
3. для новой operation читает один progression snapshot и проверяет stored
   membership `expMin <= exp < expMax`;
4. читает managed/misc naked skills и equipment modifier snapshot после hero
   lock;
5. проверяет сложение на PostgreSQL integer и wire limits;
6. находит конечный level сразу, включая multi-level jump;
7. заменяет только progression-managed naked skills, сохраняя misc skills и
   equipment неизменными;
8. пересчитывает equipment totals и вызывает существующее proportional
   HP/MP-scaling ровно один раз от старых totals к конечным totals;
9. атомарно сохраняет hero, managed skills и idempotency result с content
   release ID и progression digest.

Нулевой текущий ресурс остаётся нулём. Любая ошибка или injected failure
откатывает все записи. Hero lock обязателен и для equipment mutation, иначе
level-up может посчитать modifiers по промежуточному paperdoll.

Persisted row имеет unique `(hero_id, operation_id)`, request fingerprint
`(hero_id, operation_id, amount)` и все поля public result, включая release ID
и progression digest. Persisted operation result — character state для
exactly-once grant, не active fight state и не combat history. Presence
notification не входит в CHR-01: realtime owner появляется в `RTM-01`.

### CHR-01 acceptance

- integration: no-level, exact boundary, one-level, multi-level, L8/out-of-curve
  rejection, integer overflow, flat/percent equipment modifiers, zero/dead
  resources, retry, conflicting key, concurrent duplicate и rollback;
- publication/concurrency: unrelated или additive-artifact release активируется;
  changed progression и changed/removed existing artifact skills отклоняются
  без pointer switch; grant concurrent с compatible activation использует ровно
  один release ID;
- persistence: после direct application-port grant `init/init2`, skills,
  unitframe и state показывают одну согласованную final boundary после reconnect
  и process restart;
- content: DATA-01 manifest фиксирует counts, source digests, contiguous curve и
  provenance skill values;
- отсутствуют dev OA, runtime fixture read, combat import и duplicated
  progression formula.

CHR-01 implementation закрыт как internal enabling capability: production-клиент
не имеет отдельного EXP OA. CMB-03 — consumer боя (raw-AMF). Workflow-статус
`done` не повышает character progression до `готово`. Quest consumer ещё нет.

## CHR-02 — out-of-combat HP regeneration

### Architecture decision

Отдельный `ARC-CHAR` не нужен. Authoritative HP/maxima уже на hero;
`HPREG` — naked skill + equipped modifiers, как VIT. Clock — shared kernel
`Clock`, один экземпляр из composition root (character, wire, combat).
Background ticker на героя запрещён.

Mana regen **не изобретается**. Live/legacy `mp_time` формула не закрыта
(`HP_REGEN.md`); текущий wire берёт `mp_time` из HUD defaults (`0`). CHR-02
оставляет это как явный research gap, а не копирует HP-формулу на MP.

Ghost/injury/RESURRECT не входят: колонки и ветки ghost нет, 0 HP регенится
как обычный deficit до `CMB-04`.

Character не импортирует combat domain. Composition передаёт read-only
`ActiveFightQuery.isHeroInActiveFight(characterId)`. Реализация — адаптер
`characterId → accountId → CombatPort.activeFightId` (account↔hero 1:1).
Второй RAM index по `heroId` не нужен. Отсутствующий port — ошибка сборки
модуля, не `inFight=false`.

### Formula and policy

Происхождение `K=250` — empirical live dump, метка `legacy behavior / empirical`,
не live PHP-константа. Значение живёт в versioned `RegenPolicy` game policy,
не в catalog и не как скрытый литерал в нескольких файлах.

```
rate = HPREG / K HP/sec
hp_time = deficit <= 0 ? 0 : max(1, round(deficit * K / HPREG))
```

`hp_time=0` на клиенте значит «не регенится». Пока deficit > 0, remaining
seconds не может округлиться в 0 (иначе starter HPREG 700 и deficit 1
выглядят как полный HP). Это named client contract, не fallback для
отсутствующего HPREG.

`HPREG` — `requiredSkillTotal` naked+equipment той же pinned release, что и
другие totals. `Math.max(1, hpreg)` legacy fallback запрещён: при deficit>0
отсутствие или non-positive total — typed error без мутации.

Elapsed считается целыми unix-секундами `Clock.unixSeconds() - regen_at`.
`now < regen_at` — ошибка часов/состояния (init/unitframe тогда `204`),
elapsed не клампится в 0. Начисление:
`hp = min(hpMax, floor(hp + rate * elapsed))`, затем `hp_time` от нового
deficit. Клиентский UI (`deficit / hp_time` раз в секунду) не является
authority.

Дробный прогресс живёт в непреписанном `regen_at`. Persist только если
изменились `hp` или `hp_time`; тогда `regen_at = truncated now`. Sync,
который не дал целого HP и оставил тот же `hp_time`, **не** двигает
`regen_at` — иначе `floor(rate * elapsed)` никогда не накопит 1 HP.

### Public ports

- `syncResources({ characterId })` — lock hero, спросить active fight, применить
  elapsed либо pause; persist только при изменении `hp` или `hp_time`;
- `noteHp({ characterId, hp })` — authoritative HP write для CMB-03 и
  тестов: lock, записать `hp` в `[0, maxHp]`, пересчитать `hp_time` от нового
  deficit, `regen_at` = unix-second truncated now. Elapsed старого дефицита не
  применяется поверх нового HP.
- `setArea({ characterId, areaId, moveReadyAt })` — WLD-01: lock hero, записать
  dest и `move_ready_at` (`Date | null`). Граф переходов валидирует world
  `requireLink`, не character. Контракт: [WORLD.md](WORLD.md).

Оба порта на `Application` рядом с `grantExperience` (test/composition façade,
не OA). Идемпотентный replay `grantExperience` всё равно вызывает
`syncResources` после lock: duplicate grant — не no-op для регена.

`inActiveFight=true`: HP, `hp_time` и `regen_at` не меняются и не персистятся;
для wire `hp_time=0` overlay. PUT_ON/grant в бою могут записать maxima, но
`recomputeHpTimeAfterMutation` не трогает часы регена. Следствие: после выхода
из боя следующий `syncResources` начислит elapsed, включая длительность боя,
пока CMB-03 не сделает `noteHp` и не сбросит часы. Это legacy persist, не баг
CHR-02.

`ActiveFightQuery` реализуется адаптером `characterId → accountId →
CombatPort.activeFightId`. Account↔hero 1:1; второй RAM index по heroId не
нужен. Отсутствующий port — ошибка сборки модуля.

Read model не пишет domain state. OA `init`/`init2`/`user|unitframe`/PUT_ON/OFF
и ATTACK_BOT оборачивают lock + `syncResources` в Unit of Work, затем
BootstrapReadModel только читает.

ATTACK_BOT: `syncResources` при ещё отсутствующем fight (`inFight=false`),
затем `startHunt`, затем unitframe с overlay `hp_time=0`. Sync после
`startHunt` проглотил бы pre-fight elapsed вместе с fight wall-clock.

PUT_ON/grant: сначала `syncResources`, потом мутация maxima/HP, потом пересчёт
`hp_time` как после `noteHp`. DROP/SELL так же оборачивают lock +
`syncResources`, но не пересчитывают equipment vitals.

### INV-02 — creditMoney

Реализовано. Отдельный wallet-модуль не создаётся. Character владеет
`money_minor`. Public operation `creditMoney({ characterId, minorUnits })`:
положительное целое; итог в `[0, 2_147_483_647]`; та же hero-row lock и Unit
of Work, что DROP. Inventory не пишет `heroes`. Wire: строка в `state`, число
в `user|conf`. Полный DROP-контракт: [INVENTORY.md](INVENTORY.md).

Clock: один экземпляр из composition root в character, identity, combat и
wire. CharacterModule создаётся после CombatModule (нужен query) и принимает
`Clock` + `RegenPolicy` + `ActiveFightQuery`. `ApplicationHarness` /
`CompositionRoot.build` принимают optional `Clock` для fake-clock E2E.
Restart теста с fake clock обязан передать тот же clock; иначе новый
`SystemClock` ломает timeline. Fake реализует и `now()`, и `unixSeconds()`
согласованно.

### Persistence

`character.heroes.regen_at` — `timestamptz NOT NULL`. `hp_time` — remaining
seconds для `user|unitframe`. Creation: полные naked HP/MP, `hp_time=0`,
`regen_at` = unix-second truncated now. Policy не хранит startup `hpTime`.
Миграция `0006` backfill существующих hero: `regen_at` = момент migrate
(unix-second truncated now). Колонки `updated_at` нет.

### CHR-02 acceptance

- unit: K=250 samples из `HP_REGEN.md` (deficit 42/40/14/2 при HPREG=300),
  `hp_time` floor 1 при deficit 1 / HPREG 700, full HP, leftover `hp_time` at
  full, in-fight pause without `regen_at` write, sub-HP elapsed does not move
  `regen_at`, clock regression, missing HPREG while wounded, HPREG gear
  change updates `hp_time` without instant full heal, in-fight equipment
  mutation leaves `hp_time`/`regen_at` untouched;
- integration: persist `regen_at`, backfill, reconnect/restart, concurrent
  sync, rollback, grant replay still syncs, equip after wound, active fight
  via account-keyed `ActiveFightQuery`, in-fight vitals save without regen
  clock write;
- raw-AMF: `noteHp` then `init`/`init2`/`user|unitframe` show `hp`/`hp_time`;
  fake clock advances; harness restart передаёт тот же clock; `mp_time`
  остаётся HUD `0`; ATTACK_BOT sync-before-start; clock regression on
  init/unitframe is `204`;
- нет ticker, нет fake OA. CEF экрана результата после CMB-03 не прогонялся.

CMB-03 пишет HP с боя (raw-AMF). CEF confirmation регена после боя нет.

CHR-02 implementation закрыт как internal enabling capability: production
client не видит отдельного regen OA. Clock regression на
init/unitframe мапится в `204` через общий Error path, без отдельного
ProtocolError.

## Acceptance

- raw-AMF E2E покрывает полный init/init2 inventory, skills, HUD numbers и
  restart;
- money — строка в `state`, число в `user|conf`; `money_gold` — алмазы;
- отсутствующий обязательный catalog/hero block не маскируется пустым
  `status:100`;
- bootstrap **готово** в CAPABILITIES подтверждён CEF HUD/location smoke-test;
  character progression остаётся частичной. Equipment totals 9095 подтверждены
  CEF PUT_ON.
