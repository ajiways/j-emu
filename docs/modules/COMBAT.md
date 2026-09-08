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
- ephemeral bot IDs от `1_000_000`.

PostgreSQL выдаёт fight ID, но не хранит active fight. Terminal settlement
HP/EXP/level, loot и inventory/reward state в текущем minimal slice не
реализован. Finished history записывается best-effort на 72 часа и не является
source of truth результата.

CHR-02 читает только `ActiveFightQuery.isHeroInActiveFight(characterId)` через
account-keyed `CombatPort.activeFightId`. Combat не пишет `heroes.hp` /
`hp_time` в этом срезе; CMB-03 будет вызывать character `noteHp` на
settlement.

## Wire lifecycle

Текущий minimal hunt flow:

1. ATTACK_BOT сначала `syncResources` (боя ещё нет), затем создаёт battle и
   возвращает `fight|conf` и unitframe с overlay `hp_time=0`.
2. fproxy auth связывает client с process-owned fight.
3. Poll получает minimal terminal packet flow.
4. Terminal result добавляется в finished history.

Полный cast/effects packet flow, loot/exit ordering, durable settlement,
reconnect и fight locks относятся к будущей combat wave.

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

Целевая граница: combat получает immutable combat-ready snapshots через public
ports; catalog и inventory не импортируются как repositories внутрь fight
engine. Будущий settlement вызывает owning application ports после terminal
outcome. Это boundary requirement, а не утверждение, что reward settlement уже
работает.

Не создавать generic «будущий» battle abstraction ценой изменения работающего
legacy flow. Механики переносятся capability за capability.

## Architecture checkpoint — план

Перед глобальным refactor terminal flow нужно определить combat result
contract, идемпотентность reward orchestrator, transaction boundaries владельцев
и reconnect/restart semantics. Active combat остаётся process-local согласно
[ADR-0020](../adr/ADR-0020-ephemeral-combat.md); checkpoint не вводит active
fight tables. Ghost/injury/RESURRECT закрываются вместе с reconnect/terminal
guards в `CMB-04`, а не до появления полного combat lifecycle. Порядок
`CMB-01`–`CMB-04` и gates:
[ROADMAP.md](../migration/ROADMAP.md), workflow —
[PLAYBOOK.md](../migration/PLAYBOOK.md).

## Acceptance будущей полной combat wave

- полный hunt fight проходит в клиенте без timeout/hang;
- pocket/glove/native counters не списываются дважды;
- win/loss/leave дают правильные terminal packets и durable state;
- restart прекращает active fight без partial settlement;
- reconnect до restart восстанавливает wire state;
- DB не получает writes на каждый strike/poll.
