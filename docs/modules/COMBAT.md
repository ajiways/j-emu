# Combat

## Статус

Есть hunt melee loop (raw-AMF L/C/R, delay grant/bot-counter, kill, waiter
re-pair) и map `joinHunt`. CEF кнопки после паузы в CMB-01 не гонялись.
Pocket/glove/rage — CMB-02; shuffle 3↔3 не в этом срезе.

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
3. Melee poll: leading `attackwait` + `cast` → `{rs,sq}`; bot `cast` ~1400 ms
   позже; standalone `attacknow` ~2500 ms только кастеру. Instant
   player+bot+grant в одном execute больше нет.
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

Срез реализован: `CombatDelay` (`dueAt` + cancel по fight id), синхронный
`Battle`, `HuntMeleeScheduler` + `CombatMeleeLoop`. Production
`SystemCombatDelay` будит fproxy waiters; тесты — `MutableClock` +
`ManualCombatDelay`, без `sleep`. `Clock.schedule` нет. Урон — `BattleRules`
min/max, `damageProvenance: legacy behavior`.

Join/waiter WLD-02 не ломается: пока A в дуэли, B без `attacknow`/`oppnew`.
Если A умер и бот жив — authed B получает `oppnew`, затем `attacknow`.

CEF (кнопки после паузы, скрытие на свой удар) в этом срезе не прогонялся —
product status combat остаётся частично.

### Wire

Melee `srcType:1`, `srcId` 1/2/3 = L/C/R. HTTP `castSpell` пустой.
Успешный ending melee в **одном** poll: leading `{et:attackwait}` + `cast`
(`attack_left|center|right`) → соседний `{rs,sq}`. Нет `attacknow` и нет
удара бота в этом MULTI.

Потом bot `cast` `attack_center` (~1400 ms). Потом standalone
`{et:attacknow, restTime}` (~2500 ms) только кастеру.

Kill: `cancel(fightId)` **до** resolve; poll `attackwait`+`cast` `react=10`
и `fightFinish`; leftover `attacknow` нет.

Off-turn / waiter / already-ended: пустой HTTP + poll `{rs:true}` без HP.
Не `restriction:18` и не fproxy `error`.

### CMB-02 — pocket / glove / rage

Fproxy сейчас режет любой `srcType` кроме melee 1/2/3. Native 6/7 уже в
bootstrap `persSpells`, но не исполняются.

Loadout на `startHunt`/`joinHunt`: immutable снимок pocket + надетой
перчатки (или пусто) через inventory/catalog **ports**. Combat RAM держит
count/cp/rage; успешный карман — inventory consume из fproxy command, не
repository из domain. `{rs}` до FX для `srcType` 2/3 и native 6/7.

Content: dump-proven `spell` у **93** (хил, CD) и **99** (орб `ev:[]`);
**9095** сокеты **9098/9100/9099**. Не выдумывать титана, патронташ, 77 в
бою, `srcId:5`, generic effect engine.

Казнь / empirical `dRage` — только с меткой `legacy behavior`. Kind 11 HTTP
18 — только если в опубликованном spell это kind 11.

### Out of scope (CMB-01 leftover)

Loot/HP persist (`CMB-03`); ghost (`CMB-04`); OA FIGHT_JOIN/HELP; wander;
shuffle 3↔3; `Clock.schedule`; `startBattle`; live `10_000_000+hero.id`.

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
