# Combat

## Статус

Есть минимальный hunt (CEF стартует бой с Грызлом, второй клиент входит
через map `joinHunt`), fproxy transport, terminal packets, finished history
и queue/`oppwait`. Полный melee loop — CMB-01; shuffle 3↔3 не в CMB-01.

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
account-keyed `CombatPort.activeFightId`. `CombatService` держит один RAM
`Battle` на fight id и несколько accounts; карта ATTACK_BOT на занятую живую
точку вызывает `joinHunt` team 1. Combat не пишет `heroes.hp` / `hp_time` в этом
срезе; CMB-03 будет вызывать character `noteHp` на settlement.

## Wire lifecycle

Текущий minimal hunt flow:

1. ATTACK_BOT сначала `syncResources` (боя ещё нет), затем создаёт battle и
   возвращает `fight|conf` и unitframe с overlay `hp_time=0`.
2. `fight|conf.proxy` — live URL `https://s1.jugger.ru/fproxy//;`. CEF шлёт
   poll и `auth` на HTTPS `/fproxy//;`. Процесс также слушает TCP `:33120`
   (policy + length-prefixed AMF) как запасной путь. HTTP `auth` паркует
   bootstrap в очередь; следующий poll отдаёт `{rs}` + `{ev: fightState…oppnew}`
   - `{ev: attacknow}`. Auth/strike будят account-scoped waiters.
3. Poll получает instant player+bot+`attacknow` в одном execute — это
   **не** live turn loop; CMB-01 разносит strike/`rs`, bot counter и grant.
4. Terminal result добавляется в finished history.

Полный cast/effects packet flow, loot/exit ordering, durable settlement и
reconnect относятся к будущей combat wave.

Inventory layout lock (`PUT_ON`/`PUT_OFF`/`DROP`/`SELL` → `203` в бою) —
именованное `FightRules` в [INVENTORY.md](INVENTORY.md), не live. Live
[FIGHT_LOCK.md](../../../jgr-emu/docs/FIGHT_LOCK.md) эти коды не режет.
Трата из кармана — fproxy (`CMB-02`). World USE, COME_IN/`common|exit` и
ATTACK — live `fightBusy`; WLD-01 применяет то же `FightRules` `203`.
Карта ATTACK_BOT: ключ — spawn id; занятая живая точка — `joinHunt` team 1
на существующий RAM battle. OA `FIGHT_JOIN` / `FIGHT_HELP`
не входят. Live `10_000_000 + heroes.id` в `userId` не копировать —
participant = `heroes.id`.

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

## CMB-01 — melee turn loop

### Architecture decision

Отдельный `ARC-*` не нужен. Active fight остаётся process-local (ADR-0020).
`Clock` по-прежнему только `now` / `unixSeconds` — **не** добавлять
`schedule` в kernel. Combat владеет injected delay port: `dueAt` + cancel
по fight token. Domain `Battle` синхронный: resolve удара возвращает
события сразу; `CombatService` (или тонкий application scheduler) кладёт
bot-counter и `attacknow` в очередь по dueAt и будит fproxy waiters.
Тесты крутят FakeClock/delay без wall-clock `sleep`.

RNG остаётся `RandomSource`. Урон — текущие `BattleRules` min/max с меткой
`legacy behavior`; не переносить empirical `FIGHT_DAMAGE` как live parity.

Очереди пакетов — per-account, как сейчас. Join/waiter из WLD-02 не ломать:
пока A в дуэли, B без `attacknow`/`oppnew`.

### Wire

Melee `srcType:1`, `srcId` 1/2/3 = L/C/R. HTTP `castSpell` пустой.
Успешный ending melee в **одном** poll: leading `{et:attackwait}` + `cast`
(анимация `attack_left|center|right`) → соседний `{rs,sq}`. В этом MULTI
нет `attacknow` и нет бот-удара.

Потом отдельный poll: bot `cast` (`attack_center`). Потом standalone
`{et:attacknow, restTime}` через ~2500 ms (`FIGHT_TURN_GRANT_DELAY_MS`),
только кастеру. Bot-counter delay ~1400 ms (melee default, не AOE 3800).

Kill: очистить grant **до** resolve; в poll кастера leading `attackwait` +
`cast` с `react=KILL` (10); не оставлять `attacknow`. `fightFinish` как
сейчас.

Off-turn / waiter / already-ended: HTTP пустой, poll `{rs:true, sq}` без
strike и без HP change (`cast_ignored_not_your_turn`). Не HTTP
`restriction:18` (это kind 11, CMB-02) и не fproxy `error` string.

Если paired hunter умер, бот жив, есть waiter team 1 — waiter получает
`oppnew` и затем `attacknow` (re-pair). Shuffle 3↔3, второй бот, bot spell
roulette — не этот срез.

### Out of scope

Pocket/glove/rage/aggro (`CMB-02`); loot/HP persist (`CMB-03`); ghost
(`CMB-04`); OA FIGHT_JOIN/HELP; wander; `Clock.schedule`; generic
`startBattle`/`FightRules` consequences object; live `10_000_000+hero.id`.

### Acceptance

- unit: FakeClock delay — grant и bot-counter не в том же poll, что melee
  `rs`; cancel grant on kill; off-turn ignore;
- raw-AMF: L/C/R empty HTTP; poll order `attackwait`/`cast`/`rs`; later bot
  `cast`; later `attacknow`; waiter silent during A's loop; A die + bot live
  → B `oppnew` then `attacknow`;
- CEF: кнопки после паузы, гаснут на свой удар, бот не бьёт посреди клипа.

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
