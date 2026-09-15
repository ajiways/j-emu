# Content editor (EDT-01 / EDT-02)

Срез закрыт: HTTP drafts/activate (NPC 271) и GET document/keys + шесть
extended types. CEF Flash нет. Product **частично**:
[CAPABILITIES.md](../CAPABILITIES.md). Workflow `done`:
[ROADMAP.md](../migration/ROADMAP.md) EDT-01 / EDT-02.
Пайплайн: [CONTENT_PIPELINE.md](../architecture/CONTENT_PIPELINE.md).

Legacy `/dev/content` и dual-write fixture — только UX evidence, не контракт.
Канон — этот документ и ADR-0018.

## Ownership

Отдельный ADR и блокирующий `ARC-EDITOR` не нужны.

| Owner                            | Holds                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| `content`                        | `drafts` / `draft_versions`, candidates, validation reports, releases, audit, active pointer |
| catalog/world/quests/professions | только `materialize(releaseId, …)` из уже валидного bundle; editor их не вызывает напрямую   |
| `identity`                       | не владеет operator token                                                                    |
| `jugger-wire`                    | HTTP registrar `/operator/content/*`; не AMF, не OA                                          |
| composition                      | UoW, `ContentPublicationService` file `seed`/`publish` (bootstrap) и editor ports            |

Editor не пишет `catalog.*` / `world.*` / `quests.*` runtime rows, не трогает
`content/playable-slice.json` и не читает `jgr-emu` / `_research`.

## Public ports

Именованный `OperatorAuthPolicy`: единственный секрет
`CONTENT_OPERATOR_TOKEN` (обязателен в `loadConfig`, без default). Сравнение
timing-safe. Нет `operator_roles`. Тот же Bearer покрывает `/operator/hero/*`
(EDT-03, [CHARACTER.md](CHARACTER.md)). `created_by` на черновике — литерал
`operator` после успешного Bearer.

- `saveDraft({ contentType, contentKey, document, expectedVersion })` —
  append-only новая `draft_versions` строка. `expectedVersion` = текущий
  max version этого ключа (optimistic). Ключ обязан уже быть в **active**
  release. Документ проходит **локальную** Zod-схему своего `contentType`
  (unknown keys — ошибка). Cross-ref только на candidate.
- `buildCandidate({ overlays, expectedActiveReleaseId })` — копирует все
  `release_entries` активной release, подменяет только перечисленные ключи
  явными `draftVersionId`. Состав после create заморожен. Нет ключа в
  active / version не от этого ключа — ошибка. Новые ключи не этот срез.
- `validateCandidate(candidateId)` — собирает `ContentBundle` из
  pinned versions, гоняет существующий `ContentValidator`. Пишет
  `validation_reports`. `ok:false` **не** создаёт release и **не** двигает
  `active_release`.
- `activateCandidate(candidateId)` — требует последний report `ok:true`;
  `lockPublication()`; `expectedActiveReleaseId` всё ещё совпадает; checksum
  не занят; activation compatibility (progression digest / additive
  artifacts) как у file `publish`; materialize через те же projection ports;
  `release_entries.draft_version_id` = pinned versions (**не** вставлять
  второй комплект `draft_versions`, в отличие от текущего file
  `persistValidatedBundle`); audit row; activate pointer.

File `seed`/`publish` из bundle остаётся bootstrap-путём и может по-прежнему
создавать versions из файла. Editor-activate этот путь не использует.

## HTTP

Не AMF и не `status:203`. Encapsulated Fastify plugin
`/operator/content`. Startup снимает default JSON/text parsers, чтобы
`application/json` доходил до `*` Buffer parser; затем `JSON.parse` +
typed DTO. AMF `*` parser не снимать.

`Authorization: Bearer <CONTENT_OPERATOR_TOKEN>`.

| Method | Path                                                  | Success                                 |
| ------ | ----------------------------------------------------- | --------------------------------------- |
| POST   | `/operator/content/drafts`                            | `{ draftVersionId, version }`           |
| POST   | `/operator/content/candidates`                        | `{ candidateId }`                       |
| POST   | `/operator/content/candidates/:id/validate`           | `{ ok, reportId }`                      |
| POST   | `/operator/content/candidates/:id/activate`           | `{ releaseId, version }`                |
| GET    | `/operator/content/status`                            | active release id/version/checksum      |
| GET    | `/operator/content/document?contentType=&contentKey=` | `{ document, version, draftVersionId }` |
| GET    | `/operator/content/keys?contentType=`                 | `{ keys }`                              |

Ошибки: нет/неверный Bearer → **401**; невалидный JSON / неизвестное поле /
POST без ключа в active → **400**; GET document без ключа в active →
**404**; `expectedVersion` / `expectedActiveReleaseId` конфликт → **409**;
candidate invalid → **422** + report id; нет candidate → **404**;
внутренняя → **500**, не пустой 200.

## Schema (EDT-01)

Миграция `--name=content_editor_candidates`. PostgreSQL identity/uuid default
как у существующих content-таблиц.

- `draft_versions.created_by` text NOT NULL. Уже существующие seed-строки —
  backfill `'bootstrap'` в той же миграции; runtime `saveDraft` пишет
  `'operator'`. Пустая строка запрещена. SQL DEFAULT для новых INSERT нет.
- `candidates(id, expected_active_release_id, status, created_by, created_at)`.
  `status` ∈ `open|validated|invalid|activated`. Activated immutable.
- `candidate_entries(candidate_id, content_type, content_key, draft_version_id)`
  PK `(candidate_id, content_type, content_key)`.
- `validation_reports(id, candidate_id, validator_version, ok 0|1, issues jsonb,
created_at)`. JSONB: owner `content`, schema `1`, array `{ path, message }`,
  лимит как у `draft_versions` (1 MiB). Не `jsonb_set`.
- `publication_audits(id, release_id, candidate_id, created_by, created_at)`.

## Representative

Один ключ active slice: NPC **271** `title`. Validate/activate полного
candidate (весь playable-slice набор). Runtime после activate: USE 584 →
`npc|info` с новым title. Restart процесса читает ту же active release.
`content/playable-slice.json` не меняется.

Невалидный candidate: overlay квеста с `npcId`, которого нет в candidate
(локальная схема проходит, `ContentValidator` нет) — **422**, pointer прежний.

## Fail-fast

Нет token в env — процесс не стартует (`loadConfig`). Нет Bearer / mismatch —
401, не «открытый editor». Нет `flags`/обязательного поля в документе — не
persist. Нет `??` на active release id. Два concurrent activate — один
commit, второй 409.

`composition-root` держали ≤400: extract `create-jugger-runtime` /
`start-jugger-servers`.

## Out of this slice (EDT-01)

Визуальный `/dev/content` SPA, dual-write fixtures, SQLite, object storage,
broker, content microservice. `DATA-02…06` mass import. Новые ключи вне
active release. Rollback/export. Named operators. Extended-type proof и
GET document — EDT-02 ниже.

## EDT-02 — Extended types

Срез закрыт (GET + шесть overlays, raw-AMF). CEF Flash нет. Product
**частично**: [CAPABILITIES.md](../CAPABILITIES.md). Workflow `done`:
[ROADMAP.md](../migration/ROADMAP.md) EDT-02.

Новых таблиц, SPA и новых ключей нет. Read идёт из active PostgreSQL, не из
`playable-slice.json`. Title recipe **61** / artifact **20546** не
dump-pin в validator (presentation). Matching bootstrap `seed()` возвращает
`active_release` на bootstrap, если editor pointer уехал.

`readDocument({ contentType, contentKey })` — document + `version` (max
draft) + `draftVersionId` pinned active entry. Нет в active → 404.
`listKeys(contentType)` — ключи этого type в active, без documents.

HTTP (Bearer, query из-за `:`/`|`):

| Method | Path                                                  | Success                                 |
| ------ | ----------------------------------------------------- | --------------------------------------- |
| GET    | `/operator/content/document?contentType=&contentKey=` | `{ document, version, draftVersionId }` |
| GET    | `/operator/content/keys?contentType=`                 | `{ keys }`                              |

Representative (один candidate, шесть overlays): `store_lot` `504:80` price;
`dungeon` `1` title; `craft_recipe` `61` title; `battleground` `general|2`
title; `artifact` `20546` title; `use_script` `2827` failPlaque. Activate
один раз. OA: `store|list`, instance/book dungeon title, craft recipes list,
`arena|list`, bag/catalog title 20546, USE 2827 fail plaque. GET после
restart совпадает.

`postgres-content-editor-read-store` держит read; write-класс < 400.

### Out of EDT-02

SPA `/dev/content`, dual-write, новые ключи, rollback/export, named
operators, DATA-02…06 import. Прогон `CEF_MANUAL` Wave 0–12 — отдельный
проход после закрытия исключения, не capability очереди.
