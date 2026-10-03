# Quest engine: implementation plan QE-00A / QE-01

> **Статус:** готовая к декомпозиции техническая очередь, но не выполненный код.
> Цель — сначала полностью удалить экспериментальный runtime, затем получить
> минимальный новый vertical path без зависимости от inventory/combat/dialog UI.

## Почему это два отдельных changeset

Удаление и создание новой модели нельзя смешивать в одном огромном diff:

1. QE-00A доказывает, что старый quest runtime действительно ничему не нужен и
   что остальные модули не зависят от его side effects;
2. QE-01 добавляет новую schema и runtime на чистую границу;
3. regression после QE-01 нельзя ошибочно компенсировать оставшимся старым hook.

Между changesets сервер может временно не поддерживать quest OA-команды. Для
pre-alpha это допустимо и честнее, чем возвращать успешные заглушки.

## QE-00A — удалить старый runtime

### 00A.1. Зафиксировать удаляемую поверхность

Удаляется целиком:

- `src/modules/quests/**`;
- `src/app/quest-desk.ts`, `quest-area-oa.ts`, `quest-fight-*`,
  `quest-script-apply.ts`, старые quest codec/answer helpers;
- текущий `quest-oa-command.ts` и его регистрация;
- `book-quest-blocks.ts`/`quest-book-trio.ts` как production builders;
- quest unit/integration/E2E tests, проверяющие synthetic поведение;
- synthetic quest definitions из `content/playable-slice.json`;
- `collect-quest-issues.ts` и special-case requirements `q_engine_*`;
- `docs/modules/QUESTS.md` после переноса полезных wire observations в fixtures.

Перед удалением wire snapshots, которые подтверждены реальным клиентом, должны
быть сохранены как inert characterization fixtures без импорта production code.
Синтетические ожидания старого сервера доказательством не считаются.

### 00A.2. Разорвать cross-module hooks

Изменяются, но не удаляются:

- `CompositionRoot`: убрать `QuestsModule`, catalog/service wiring и terminal
  chain;
- `JuggerCommandModule`: убрать `QuestDesk` и quest dependencies команд;
- USE/DROP/PUT_ON/STORE BUY: оставить только owning inventory/store mutation;
- fight settlement/loot: убрать quest observer и `needed()` lookup;
- bootstrap/long-poll: убрать quest book/board blocks;
- content validator/materializer/document/parser: убрать старый `QuestDocument`
  и materialization в старую schema.

После этого inventory, store и combat не содержат optional `quests?` callback.
Новые typed event ports будут добавляться только вместе с конкретным tracer.

### 00A.3. Content boundary

Текущие `QuestDocument`, `NpcDocument` и `WorldFactDocument` находятся в одном
quest-oriented source и materialize-ятся в schema `quests`. При удалении:

- старый `quests` массив исчезает из content bundle;
- старые NPC/world-fact rows этой schema удаляются;
- если NPC catalog уже нужен независимому модулю, `NpcDocument` переносится в
  отдельный content type только после проверки его consumers;
- новый `quest.v1` content type добавляется заново в QE-01, без совместимого
  parser для старой формы.

Нельзя оставить старый parser «для будущего импорта»: importer должен явно
конвертировать source data в `quest.v1` и пройти новую validation.

### 00A.4. Database cleanup

Добавляется новая append-only migration:

```sql
DROP SCHEMA IF EXISTS quests CASCADE;
```

Старые migration files не переписываются: чистая БД последовательно создаст и
удалит schema, что сохраняет проверяемую историю репозитория. Отдельный будущий
migration squash возможен, но не является частью quest engine.

Одновременно Drizzle exports старых tables удаляются из production schema.
QE-01 следующей миграцией создаёт `quests` заново уже с новой моделью.

### 00A.5. Acceptance

- `rg` не находит production import из `modules/quests` и `QuestDesk`;
- content candidate без старых quests validate/materialize/activate проходит;
- inventory USE/DROP/PUT_ON, store purchase и combat settlement проходят свои
  существующие tests без quest callback;
- migration test с пустой БД проходит и schema `quests` отсутствует;
- незарегистрированная quest OA-команда не меняет state и получает стандартный
  unsupported-command response;
- unit, integration, E2E, lint, architecture и dead-code checks зелёные.

## QE-01 — immutable definition и run foundation

### Первый tracer: TQ-0 Foundation talk

Это технический tracer, а не игровой квест:

```text
available by level
→ accept command
→ one active objective: подтвердить разговор с NPC
→ talk event
→ ready/turn-in command
→ fixed reward package без item effects
→ completed history
```

Он намеренно не требует полноценного dialog graph, item provenance, combat,
party или timers. Accept/talk/turn-in вызываются application-level test API;
client dialog/wire подключается позднее отдельным slice. Tracer удаляется либо
становится dev fixture после появления реального контента.

### 01.1. Новый package layout

```text
src/modules/quests/
  domain/
    compiled-definition.ts
    run.ts
    transition-plan.ts
    registries.ts
  application/
    quest-application-facade.ts
    quest-definition-compiler.ts
    quest-event-router.ts
    quest-transition-engine.ts
  ports/
    quest-definition-repository.ts
    quest-run-repository.ts
    quest-history-repository.ts
    quest-evaluation-snapshot.ts
  infrastructure/postgres/
    schema.ts
    postgres-quest-*.ts
  quests-module.ts
```

`app` не импортирует domain internals. Composition root получает только module
facade/catalog/public event input. Wire, inventory и combat imports внутри
quest module запрещены architecture check.

### 01.2. Authoring и compilation

- добавить strict parser `quest.v1` из `AUTHORING_SCHEMA_V1.md`;
- зарегистрировать только capabilities, необходимые TQ-0:
  conditions `level`, requirements `talk`, effect `grant_experience` либо пустой
  reward, graph nodes `objective/reward/end`;
- compiler проверяет references/reachability/terminal path и строит immutable
  compiled JSON + event-interest index;
- content materializer пишет definition revision в той же candidate activation
  UoW;
- unknown capability отклоняет publication, а не остаётся dormant.

Unsupported v1 types можно парсить только после появления их полного handler;
широкая union schema без runtime реализации запрещена.

### 01.3. Minimal persistence

Первая новая migration содержит только таблицы, реально используемые TQ-0:

- `definition_revisions`;
- `event_interests`;
- `runs`;
- `stage_instances`;
- `requirement_progress`;
- `command_receipts`;
- `event_receipts`;
- `effect_receipts` при наличии reward effect;
- `run_history`;
- `projection_revisions`.

Dialogs, operations, waits, encounters, assets и repeat claims добавляются в
своих slices. Их будущие contracts уже описаны, но пустые таблицы заранее не
создаются.

### 01.4. Transaction path

`accept`, `applyEvent` и `turnIn` следуют одному шаблону:

1. открыть общую PostgreSQL UoW;
2. заблокировать hero;
3. загрузить active release/закреплённую definition;
4. заблокировать run, если он существует;
5. проверить command revision либо event receipt;
6. вызвать pure transition engine;
7. сохранить state/history/receipts и transactional effects;
8. увеличить projection revision;
9. commit;
10. вернуть read model из committed state.

Run pin-ится на `(releaseId, questKey)` в момент accept. Новая publication не
меняет уже созданный run. Поскольку production нет, первая rollout policy может
запрещать activation changed quest при active runs; массовая cancellation будет
добавлена позднее.

### 01.5. Test set

Unit:

- strict schema rejects unknown/missing fields;
- compiler rejects missing references, cycle и unreachable terminal;
- transition model: available → active → ready → completed;
- duplicate talk event не увеличивает progress;
- event старой stage generation игнорируется;
- same facts в разном допустимом порядке дают одинаковый snapshot.

PostgreSQL integration:

- candidate materialization + activation atomic;
- concurrent accept создаёт один active run;
- duplicate `(eventId, runId)` имеет один effect;
- restart сохраняет active stage и completed history;
- archived/changed release не переписывает history snapshot;
- transaction rollback не оставляет partial progress/reward.

Architecture:

- quest domain/application не импортирует wire/Postgres implementation;
- другие domain modules не импортируют quest internals;
- production code не сравнивает `questKey` с TQ-0 key;
- каждый compiled discriminator имеет handler exact version.

## Checkpoint после QE-01

К следующему этапу можно переходить только если:

- старого runtime физически нет;
- TQ-0 проходит через новый definition compiler/run/transition/receipt/history;
- restart и concurrent retry доказаны PostgreSQL tests;
- ни dialog, ни inventory, ни combat ещё не имеют временных обходов;
- все последующие capabilities добавляются расширением registry и новым tracer,
  а не условием по конкретному квесту.

Следующий slice после этого checkpoint — QE-02: composite requirements и graph
closure на TQ-2, затем QE-03 typed event adapters/effects. Client dialogs не
подключаются до появления persisted dialog sessions.
