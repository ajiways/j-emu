# Reputation (REP-01)

## Статус

Срез REP-01 реализован на raw-AMF: catalog track **5**, `grantReputation`, OA
`user|stats`. CEF экран репутации не обязателен. Product-status остаётся
**частично**: [CAPABILITIES.md](../CAPABILITIES.md). Workflow-статус в
[ROADMAP.md](../migration/ROADMAP.md) — `done`.

## Источники поведения

- `jgr-emu/docs/REPUTATION.md`;
- `jgr-emu/src/reputation.ts`, `src/heroLifetime.ts` (`buildNamedUserStats`),
  `src/routes/oa/user.ts` (`user|stats`);
- authored `jgr-emu/fixtures/reputation_tracks.json`;
- curated `quests_curated/q_1.json` `award.rep` object_id **5** amount **10**
  cap **0**. Engine-consumer landed: `q_engine_multi` `GRANT_AWARDS` (не
  `q_1`). `GRANT_REP` op и q_4…q_9 / q_10+ — CONTENT-STORY. Live борд шлёт
  `award_rep:""`; репа не AMF-поле строки доски.

Не переносить kill overlay, чат «Получено: N репутации», SET_FLAG unlock
grant, clan SUM как хранимый track, `reputation_kills.json`.

## Architecture decision

Отдельный `ARC-CHAR` / `ARC-*` не нужен. Catalog владеет authored треками. Character владеет player values
(`hero_reputations`) и портом `grantReputation`. Combat/inventory/quests не
пишут эти таблицы. Derived **Суммарная** `object_id` **36** type **3** не
хранится и не является целью гранта: SUM type:2 на чтении. Store-лот может
гейтить object **36** как derived SUM, не как catalog track.

Curated 1–8 грантит только Радвей **5** (empty `unlock_flag` = всегда можно).
Pred `REPUTATION` в q_1…q_8 нет. `reputation_kills.json` не импортируется —
hunt Gryzl репу не даёт. Kill-grant и quest scripts — leftover до QST/CHT.
Непустой `unlockFlag` на гранте — ошибка `unlock is not implemented`, не skip.

## Content set

DATA-05: 22 type-2 трека из `content/reputation-tracks.json` →
`reputation-tracks.generated.json` (Радвей **5** empty unlock; 7/11/… с
`unlockFlag`; **125** «Своего человека»). Track **36** в catalog не
публиковать. `reputation_kills` не импортируется.

## Schema

- `catalog.reputation_tracks(release_id, object_id, type, title, image,
unlock_flag)` PK `(release_id, object_id)`; type 2; `unlock_flag` пустая
  строка = всегда grantable;
- `character.hero_reputations(hero_id, object_id, value)` PK `(hero_id,
object_id)`; FK heroes; `value` integer `CHECK >= 0`; clamp 0…**7000** для
  id 5.

SQL DEFAULT только для migrate; runtime пишет явные значения. Нулевые type:2
строки не обязательны: нет row = 0.

## Public ports

`grantReputation({ characterId, objectId, amount, cap })`:

- `objectId` обязан быть опубликованным type:2;
- грант на 36 — ошибка, не ignore-и-успех;
- непустой `unlockFlag` — ошибка `unlock is not implemented`;
- `amount` целое ≥ 1; `cap` 0 = без капа источника, иначе `current >= cap` →
  delta 0 без ошибки;
- clamp итога 0…7000; не клампить 36 (его нет как row);
- hero row lock + одна UoW; неизвестный track / ghost — typed error, не +0.

Read: список type:2 с value > 0 + computed SUM для wire.

## Wire

OA `user|stats` (live `dispatchUser` stats) — production consumer, не fake OA.
Nested `{ status:100, stats, farm_stats:[], fish_stats:[] }`. `stats` —
dump-proven named rows `type_id:"13"`: опыт (1), героизм (2) = `hero.honor`
(HERO-01 `grantHonor` пишет `heroes.honor`; этот срез не грантит героизм), нули kill/duel/
fatality/daily, затем type:2 только если value > 0, всегда **36** type 3
«Суммарная репутация». Image у type:2 с каталога. Нулевые type:2 не слать.

Reconnect/restart читает PostgreSQL. Chat grant notify — часть `SOC-01`
(system notifications) в [ROADMAP.md](../migration/ROADMAP.md).

## Fail-fast

Не копировать live fixture `loadReputationTracks` в runtime. Нет track 5 в
release — публикация/грант падает. Не подставлять другой object_id.

## Out of scope

Kill overlay; SET_FLAG `rep_*` grant; GRANT_REP scripts; chat;
`reputation_kills`; fame как отдельный SUM-row; farm_stats professions;
user_info HTML.

## Acceptance

- unit: grant 5 +10, clamp 7000, cap skip, reject 36 / unknown id;
- integration: persist reconnect/restart; concurrent grant one winner;
- raw-AMF: `user|stats` без гранта — нет type:2, SUM 36 = 0; после
  `grantReputation(5,10)` — type:2 5 value 10 и SUM 36 = 10;
- CEF экран репутации не обязателен для REP-01. Квестовый consumer —
  `q_engine_multi` turn-in (product **частично** до CEF QST-ENG-03).
