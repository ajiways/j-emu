# Quest engine: server authoring API v1

> **Статус:** contract QE-11 для будущего редактора. UI не получает прямой
> доступ к PostgreSQL/content files и не компилирует definitions самостоятельно.

## Resource model

API работает с существующим content draft/candidate/release lifecycle:

- list/read/create/update/archive quest draft;
- catalog/reference lookups;
- validate one document и whole candidate;
- compile preview без activation;
- semantic diff/impact;
- simulate graph/dialog;
- publish через общий candidate activation.

Draft update использует optimistic revision/ETag. Unknown/new schema version не
редактируется старым UI, но может быть прочитана raw только администратором.

## Quest operations

Semantic endpoints/handlers:

```text
ListQuestDrafts(filter, cursor)
GetQuestDraft(questKey)
CreateQuestDraft(key, template)
UpdateQuestDraft(key, expectedRevision, document)
ArchiveQuestDraft(key, expectedRevision)
CloneQuestDraft(sourceKey, newKey)
ValidateQuestDraft(key)
PreviewQuestCompilation(key)
```

Create резервирует semantic quest key, но wire ids выделяются reservation plan
при candidate compilation. Update хранит весь strict document; partial JSON
patch допустим только с server-side parse результата.

## Catalog lookups

Typed lookup для NPC, bot, artifact, area/object, store, profession, recipe,
assistant, reputation, quest/outcome, fact, macro capability. Result содержит:

- semantic/numeric id;
- display label/preview;
- immutable revision/digest;
- relevant constraints (stack, profession category, area kind);
- archived/deprecated state.

Editor не сохраняет display label как reference identity.

## Validation response

Используется `QuestCompileIssue`: stable code, severity, JSON path, related
paths, metadata. Response дополнительно содержит:

- compiled graph summary;
- event/condition/effect dependency list;
- allocated/reserved wire identity preview;
- unreachable/ambiguous paths;
- client surface compatibility issues;
- estimated active-run rollout impact.

## Simulator

Simulator не мутирует героя/БД. Input:

- definition/candidate revision;
- synthetic hero/world/inventory/party snapshot;
- initial run/session state либо fresh accept;
- ordered commands/events;
- forced RNG/check outcomes;
- injected clock.

Output после каждого шага:

- run/stage/requirements/decisions;
- board/dialog/journal/world projections;
- planned effects/operations без выполнения;
- audit trail/denials;
- invariant/validation issues.

Simulator использует тот же compiler/transition engine, не отдельную упрощённую
реализацию.

## Dialog preview

Поддерживает:

- открыть scene/entry;
- выбрать answer;
- close/reopen;
- force check success/failure;
- presenter/body/answer/reward icon semantic preview;
- exact client preview только через server wire adapter fixture renderer.

## Candidate diff и rollout

Diff классифицирует:

- presentation-only;
- behavior-compatible;
- behavior-changed;
- removed/archived;
- catalog dependency changed;
- wire identity added/removed/collision.

Impact: active run counts, owned temporary asset kinds, waits/encounters,
cancellation feasibility и downstream quest dependencies. Publish требует
явной policy и повторной проверки impact под activation lock.

## Audit/security

- authenticated operator identity;
- every write/publish archived audit record;
- size/rate limits;
- no script/HTML/SQL execution;
- rich content/macro allowlist per surface;
- validation cannot fetch arbitrary URL/file;
- catalog lookup and simulator redact secrets/internal errors.

## UI boundary

Editor layout (node positions, collapsed panels, personal workspace) хранится
отдельно. Semantic document round-trip не зависит от UI. Unknown field не
теряется молча: editor запрещает save до upgrade либо сохраняет whole raw
document только explicit expert flow.

## Acceptance

- TQ-1 и TQ-13 создаются без file/DB patch;
- stale update conflict;
- validation paths открывают нужный field/node;
- simulator совпадает с runtime golden trace;
- preview close/reopen/check не reroll-ит;
- candidate diff показывает downstream/active-run impact;
- publish atomic с general content release;
- audit связывает operator/draft/candidate/release.
