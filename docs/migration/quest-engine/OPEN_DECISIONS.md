# Quest engine: open decisions and implementation blockers

> **Статус:** живой реестр неизвестного. Вопрос не должен неожиданно возникать
> внутри implementation PR: здесь указано, блокирует ли он фундамент, конкретный
> capability или только перенос отдельного квеста.

## Уже решено — не переоткрывать без новых данных

- старый quest runtime/tables/progress удаляются без совместимости;
- один run имеет одну player-facing current цель, цель может быть составной;
- definitions immutable и run pinned к release;
- активные runs изменённого квеста в будущем отменяются rollout policy;
- party использует персональные runs/rewards/loot;
- обычная reward переполняет inventory;
- temporary assets имеют provenance lots и exact cleanup;
- external/RAM actions идут через durable operations;
- combat terminal fact durable с settlement;
- произвольных scripts/quest-key branches нет;
- UI редактора начинается после server authoring API.

## Безопасные defaults — фундамент не блокируют

| Вопрос                       | Default v1                                            |
| ---------------------------- | ----------------------------------------------------- |
| pre-accept reopen            | `resume_checkpoint`                                   |
| speech/probability retry     | один committed attempt на authored scope              |
| arbitrary graph cycle        | запрещён, только bounded repeat                       |
| failed quest lifecycle       | reserved, не authorable без evidence                  |
| temporary asset transfer     | hero-bound                                            |
| lost RAM fight               | recovery/recreate, не автоматическая победа/поражение |
| active revision migration    | отсутствует; cancel/restart run                       |
| close dialog event ненадёжен | correctness от него не зависит                        |
| downtime wait                | wall-clock продолжает идти                            |
| server-global world mutation | вне v1                                                |

Изменение default требует отдельной product decision и новых tracer tests.

## Блокирует точный client wire, но не semantic runtime

- stale/retry и piggyback ordering reward selection;
- различие favorite/tracked/selected для всех версий клиента;
- какие dialog close/navigation commands реально отправляет клиент;
- macro/HTML allowlist по surfaces;
- exact rendering редких wait/video/provider portrait combinations;
- empty board/empty NPC marker behavior.

Правило: semantic projection можно реализовать заранее. Wire adapter конкретной
surface не объявляется готовым без raw fixture/golden test.

Common NPC point bits (`8/16/32/64`), используемые quest bits
(`1/32/64/4096`), базовый `award_list/award_id` и различие между локальным
answer delay и `common|waiting` уже закрыты AS3 + `reg_6lvl`. Открыты редкие
комбинации, stale/retry и CEF pixel parity, а не форма основного контракта.

## Блокирует отдельные capabilities

### Oratory/checks

Неизвестны оригинальная формула stats/modifiers и repeat policies. Generic
persisted check runtime реализуется, но original quest импорт ждёт evidence;
новый контент использует явно authored threshold/probability.

### Failure

Не подтверждено общее состояние «квест провален». Engine резервирует terminal
`failed`, но authoring schema не открывает его. Loss/expiry моделируются
branch/reset/retry/cancel.

### Time-window content

Infrastructure IANA/DST определена, но конкретные игровые окна требуют source
evidence. Нельзя подставлять server local timezone.

### Profession replacement

Mechanism explicit remove+grant определён; точные оригинальные refund/reset
правила блокируют только импорт replacement quest.

## Блокирует только перенос конкретных квестов

### Грого

- точный commit point exile;
- reward/reputation branches;
- cancel после решения;
- downstream quest replacements;
- empty hut/marker wire behavior.

### Путь ведьмака

- drop/expire/reissue пяти кольев;
- reset конкретной могилы;
- loss/retry Смертомора;
- lifetime/обязательность Перстня;
- точный unlock reputation track.

### Атаман Бешеный Бык

- retries неправильного пароля;
- разговор без/после потери маски;
- смена реагента;
- финальный loss/reissue;
- commit succession;
- fate книги и `rep_11` unlock.

Эти вопросы не разрешаются удобными догадками. Definition остаётся draft с
`UNKNOWN` evidence annotation и не публикуется как authentic port.

## Необходимые repository spikes

Не продуктовые вопросы, но до соответствующего slice нужны короткие spikes:

1. полный inventory write-path inventory для lot backfill/invariant;
2. возможность добавить purposeRef/idempotency lookup в RAM combat;
3. shared leased-worker infrastructure и schema `runtime`;
4. raw fixture capture существующих book/dialog/AREA responses;
5. current content editor extension point для per-type compiler artifacts;
6. lock/deadlock test harness для multihero UoW.

Spike заканчивается документированным решением/test fixture, а не временным
production workaround.

## Как закрывать вопрос

Каждое решение записывает:

- source/evidence и confidence;
- affected schema/capability;
- chosen behavior;
- backward/rollout impact;
- tracer/golden test;
- обновлённые документы.

Если ответ не влияет на текущий slice, он не блокирует implementation и не
маскируется TODO в production code.
