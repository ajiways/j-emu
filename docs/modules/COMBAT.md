# Combat

## Статус

Есть минимальный hunt fight, fproxy transport, terminal packets и finished
history. Полный legacy combat loop ещё не перенесён.

## Источники поведения

Основной lifecycle:

- `jgr-emu/docs/FIGHT_MODEL.md`;
- `jgr-emu/docs/FIGHT_CAST_ACK.md`;
- `jgr-emu/docs/FIGHT_LOOT.md`;
- `jgr-emu/docs/FIGHT_RECONNECT.md`;
- `jgr-emu/docs/FIGHT_TOASTS.md`.

Механики: `FIGHT_TURN_UI`, `FIGHT_RAGE`, `FIGHT_JOIN`, `FIGHT_LOCK`, `POCKET`,
`GLOVE_MAGIC`, `BOT_SPELLS`.

`FIGHT_DAMAGE` и `FIGHT_MAGIC` содержат empirical/invented formulas. При
переносе они получают явную метку `legacy behavior`, не live parity.

## Runtime model

Active combat целиком process-local:

- participants, teams, HP, turns, effects и RNG state;
- command and outbound packet queues;
- reconnect data до restart;
- ephemeral bot IDs от `1_000_000`.

PostgreSQL выдаёт fight ID, но не хранит active fight. Terminal settlement
атомарно меняет durable hero/inventory/reward state. Finished history записывается
best-effort на 72 часа и не является source of truth результата.

## Wire lifecycle

Core hunt flow:

1. ATTACK_BOT создаёт battle и возвращает `fight|conf`.
2. fproxy auth связывает client с process-owned fight.
3. Poll получает MULTI packets; cast acknowledgement и effects приходят в
   подтверждённом порядке.
4. Terminal outcome применяет settlement.
5. esrv отправляет loot/exit в legacy order.
6. Bootstrap после reconnect показывает durable result.

SINGLE/MULTI framing, exact `sq`, source IDs и packet order менять нельзя.

Критический client-side behavior:

- pocket/glove: успешный `rs` идёт до strike, иначе клиент дважды списывает
  count/cost;
- melee ending: strike идёт до `rs`;
- rage `srcId:6` и aggro `srcId:7` также требуют `rs` до strike;
- glove combo списывает `cp - cost`, а не обнуляет CP;
- unsupported targetless spell возвращает HTTP restriction, а не fake poll
  success;
- turn grant очищается до resolving killing strike.

## Границы модулей

Combat получает immutable combat-ready snapshots через public ports. Catalog и
inventory не импортируются как repositories внутрь fight engine. Settlement
вызывает owning application ports после terminal outcome.

Не создавать generic «будущий» battle abstraction ценой изменения работающего
legacy flow. Механики переносятся capability за capability.

## Acceptance

- полный hunt fight проходит в клиенте без timeout/hang;
- pocket/glove/native counters не списываются дважды;
- win/loss/leave дают правильные terminal packets и durable state;
- restart прекращает active fight без partial settlement;
- reconnect до restart восстанавливает wire state;
- DB не получает writes на каждый strike/poll.
