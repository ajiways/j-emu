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

CHR-01 — internal enabling capability: production-клиент пока не может создать
EXP grant без CMB-03/quest consumer. Поэтому завершение implementation item не
повышает character progression до `готово` и не требует бессодержательного CEF
сценария. Первый реальный consumer обязан добавить raw-AMF и CEF acceptance.

`CHR-02` после него задаёт authoritative regeneration timestamps и lazy
calculation. Ghost/injury/RESURRECT относятся к `CMB-04`; honor progression — к
его собственной capability. Порядок: [ROADMAP.md](../migration/ROADMAP.md),
workflow — [PLAYBOOK.md](../migration/PLAYBOOK.md).

## Acceptance

- raw-AMF E2E покрывает полный init/init2 inventory, skills, HUD numbers и
  restart;
- money — строка в `state`, число в `user|conf`; `money_gold` — алмазы;
- отсутствующий обязательный catalog/hero block не маскируется пустым
  `status:100`;
- bootstrap **готово** в CAPABILITIES подтверждён CEF HUD/location smoke-test;
  character progression остаётся частичной. Equipment totals 9095 подтверждены
  CEF PUT_ON.
