import { randomBytes } from "node:crypto";
import type { Clock } from "../../../shared/kernel/clock.ts";
import { requirePresent } from "../../../shared/kernel/require-present.ts";
import { parseDecimalId, requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { Battle } from "../domain/battle.ts";
import type { BattleRules } from "../domain/battle-rules.ts";
import { EphemeralBotFightIds } from "../domain/ephemeral-bot-fight-ids.ts";
import { FinishedFightConflictError } from "../domain/finished-fight-conflict-error.ts";
import { HuntJoinDenied } from "../domain/hunt-join-denied.ts";
import type { RandomSource } from "../domain/random-source.ts";
import type { CombatDelay } from "../ports/combat-delay.ts";
import type { CombatWake } from "../ports/combat-wake.ts";
import type { FinishedFightRecorder } from "./finished-fight-recorder.ts";
import type { HistoryWriteObserver } from "./history-write-observer.ts";
import { CombatMeleeLoop } from "./combat-melee-loop.ts";
import { huntBattleInitFromStart } from "./hunt-battle-init-from-start.ts";
import { HuntMeleeScheduler } from "./hunt-melee-scheduler.ts";
import type {
  CombatEvent,
  CombatPort,
  FightCommand,
  FightExit,
  FightStart,
  HuntJoinInput,
  HuntStartInput,
} from "../ports/combat-port.ts";
import type { FightIdSource } from "../ports/fight-id-source.ts";
import type { FightTerminalObserver } from "../ports/fight-terminal-observer.ts";

export class CombatService implements CombatPort {
  private readonly byAccount = new Map<number, Battle>();
  private readonly battleByFight = new Map<string, Battle>();
  private readonly queues = new Map<number, CombatEvent[]>();
  private readonly pendingExits = new Map<number, FightExit>();
  private readonly pendingPocketConsume = new Map<number, number>();
  private readonly botFightIds = new EphemeralBotFightIds();
  private readonly scheduler: HuntMeleeScheduler;
  private readonly melee: CombatMeleeLoop;
  private terminal: FightTerminalObserver | undefined;
  private wakePort: CombatWake | undefined;

  constructor(
    private readonly ids: FightIdSource,
    private readonly random: RandomSource,
    private readonly rules: BattleRules,
    clock: Clock,
    private readonly history: FinishedFightRecorder,
    private readonly historyWrites: HistoryWriteObserver,
    delay: CombatDelay,
  ) {
    this.scheduler = new HuntMeleeScheduler(delay, clock);
    this.melee = new CombatMeleeLoop(
      this.byAccount,
      this.battleByFight,
      this.pendingExits,
      this.scheduler,
      (accountId, events) => this.enqueue(accountId, events),
      (accountId) => this.wakeAccount(accountId),
      (battle, events, strikerAccountId) => this.settleFinished(battle, events, strikerAccountId),
    );
  }

  bindTerminalObserver(observer: FightTerminalObserver): void {
    if (this.terminal) throw new Error("Fight terminal observer is already bound");
    this.terminal = requirePresent(observer, "Fight terminal observer is required");
  }

  bindWake(wake: CombatWake): void {
    if (this.wakePort) throw new Error("Combat wake is already bound");
    this.wakePort = requirePresent(wake, "Combat wake is required");
  }

  async nextFightId(): Promise<string> {
    return this.ids.nextFightId();
  }

  async hasFight(fightId: string): Promise<boolean> {
    return this.battleByFight.has(requireFightId(fightId));
  }

  async startHunt(input: HuntStartInput): Promise<FightStart> {
    requireWireIdentity(input.accountId, "account id");
    requireWireIdentity(input.heroId, "hero id");
    if (this.byAccount.has(input.accountId)) throw new Error("Account already has an active fight");
    const fightId = requireFightId(input.fightId);
    if (this.battleByFight.has(fightId)) throw new Error(`Fight ${fightId} is already active`);
    const accessKey = randomBytes(16).toString("hex");
    const battle = new Battle(
      huntBattleInitFromStart(
        { ...input, fightId },
        accessKey,
        this.botFightIds.allocate(input.heroId),
        this.scheduler.now(),
      ),
      this.rules,
      this.random,
    );
    this.byAccount.set(input.accountId, battle);
    this.battleByFight.set(fightId, battle);
    return {
      fightId,
      accessKey,
      participantId: input.heroId,
      arena: input.arena,
    };
  }

  async joinHunt(input: HuntJoinInput): Promise<FightStart> {
    requireWireIdentity(input.accountId, "account id");
    requireWireIdentity(input.heroId, "hero id");
    if (input.team !== 1) throw new Error("Hunt join team must be 1");
    if (this.byAccount.has(input.accountId)) throw new HuntJoinDenied("уже в бою");
    const fightId = requireFightId(input.fightId);
    const battle = this.battleByFight.get(fightId);
    if (!battle || battle.finished) throw new HuntJoinDenied("бой не найден");
    if (battle.areaId !== input.areaId) throw new HuntJoinDenied("бой в другой локации");
    if (battle.hasHuman(input.accountId, input.heroId)) {
      throw new HuntJoinDenied("вы уже участвовали в этом бою");
    }
    const roster = battle.addHuman({
      accountId: input.accountId,
      heroId: input.heroId,
      nick: input.heroNick,
      level: input.heroLevel,
      kind: input.heroKind,
      hp: input.heroHp,
      maxHp: input.heroMaxHp,
      mp: input.heroMp,
      maxMp: input.heroMaxMp,
      loadout: input.loadout,
    });
    this.byAccount.set(input.accountId, battle);
    for (const accountId of battle.authedAccountIds()) {
      if (accountId === input.accountId) continue;
      this.enqueue(accountId, [roster]);
    }
    return {
      fightId: battle.id,
      accessKey: battle.accessKey,
      participantId: input.heroId,
      arena: battle.arena,
    };
  }

  async execute(accountId: number, command: FightCommand) {
    if (command.kind === "poll") {
      const queue = this.queues.get(accountId);
      if (!queue) return [];
      this.queues.delete(accountId);
      return queue;
    }
    if (command.kind === "authenticate") {
      const battle = this.byAccount.get(accountId);
      if (!battle) throw new Error("Active fight not found");
      if (command.fightId !== battle.id) throw new Error("Fight id does not match active fight");
      this.enqueue(accountId, [
        { type: "command-accepted", sequence: command.sequence, accessKey: battle.accessKey },
        ...battle.authenticate(accountId),
      ]);
      return [];
    }
    if (command.kind === "strike") {
      await this.melee.strike(accountId, command.side, command.sequence);
      return [];
    }
    await this.castSpecial(accountId, command);
    return [];
  }

  takePocketConsume(accountId: number): number | null {
    const itemId = this.pendingPocketConsume.get(accountId);
    if (itemId === undefined) return null;
    this.pendingPocketConsume.delete(accountId);
    return itemId;
  }

  async activeFightId(accountId: number): Promise<string | null> {
    return this.byAccount.get(accountId)?.id ?? null;
  }

  async accountForFight(fightId: string): Promise<number | null> {
    const battle = this.battleByFight.get(requireFightId(fightId));
    if (!battle) return null;
    return battle.accountId;
  }

  async takeExit(accountId: number) {
    const value = this.pendingExits.get(accountId);
    if (!value) return null;
    this.pendingExits.delete(accountId);
    return value;
  }

  async peekExit(accountId: number) {
    return this.pendingExits.get(accountId) ?? null;
  }

  shutdown(): void {
    for (const fightId of this.battleByFight.keys()) this.scheduler.cancel(fightId);
    this.byAccount.clear();
    this.battleByFight.clear();
    this.queues.clear();
    this.pendingExits.clear();
    this.pendingPocketConsume.clear();
  }

  private async castSpecial(
    accountId: number,
    command: Extract<FightCommand, { kind: "pocket" | "glove" | "rage" | "aggro" }>,
  ): Promise<void> {
    const battle = this.byAccount.get(accountId);
    if (!battle) {
      this.enqueue(accountId, [{ type: "command-accepted", sequence: command.sequence }]);
      return;
    }
    const nowMs = this.scheduler.now().getTime();
    if (command.kind === "pocket") {
      const resolved = battle.tryPocket(accountId, command.itemId, nowMs, command.sequence);
      this.finishKeepTurn(accountId, command.sequence, resolved);
      return;
    }
    if (command.kind === "rage") {
      this.finishKeepTurn(accountId, command.sequence, battle.tryRage(accountId));
      return;
    }
    if (command.kind === "aggro") {
      this.finishKeepTurn(accountId, command.sequence, battle.tryAggro(accountId));
      return;
    }
    const resolved = battle.tryGlove(accountId, command.spellId, command.sequence);
    if (resolved.kind === "ending") {
      await this.melee.endingGlove(accountId, command.sequence, resolved.events);
      return;
    }
    this.finishKeepTurn(accountId, command.sequence, resolved);
  }

  private finishKeepTurn(
    accountId: number,
    sequence: string | number,
    resolved:
      | { kind: "ignored" }
      | { kind: "resolved"; events: readonly CombatEvent[]; consumePocketItemId?: number },
  ): void {
    if (resolved.kind === "ignored") {
      this.enqueue(accountId, [{ type: "command-accepted", sequence }]);
      return;
    }
    if (resolved.consumePocketItemId !== undefined) {
      this.pendingPocketConsume.set(accountId, resolved.consumePocketItemId);
    }
    this.melee.keepTurn(accountId, sequence, resolved.events);
  }

  private async settleFinished(
    battle: Battle,
    events: readonly CombatEvent[],
    strikerAccountId: number,
  ): Promise<void> {
    const finished = events.find((event) => event.type === "finished");
    if (!finished || finished.type !== "finished") {
      throw new Error("Finished battle did not produce a finished event");
    }
    this.scheduler.cancel(battle.id);
    await this.recordHistory(battle, finished.winnerTeam);
    const exit = { fightId: battle.id, winnerTeam: finished.winnerTeam };
    for (const accountId of battle.accountIds()) {
      if (accountId !== strikerAccountId) this.enqueue(accountId, [finished]);
      this.pendingExits.set(accountId, exit);
      this.byAccount.delete(accountId);
      this.wakeAccount(accountId);
    }
    this.battleByFight.delete(battle.id);
    await this.notifyFinished(battle.accountId, battle.id);
  }

  private async notifyFinished(accountId: number, fightId: string): Promise<void> {
    if (!this.terminal) return;
    await this.terminal.afterFinished({ accountId, fightId });
  }

  private async recordHistory(battle: Battle, winnerTeam: 1 | 2): Promise<void> {
    try {
      await this.history.record(battle, winnerTeam);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      if (error instanceof FinishedFightConflictError) {
        this.historyWrites.conflict(battle.id, failure);
      } else {
        this.historyWrites.failed(battle.id, failure);
      }
    }
  }

  private enqueue(accountId: number, events: readonly CombatEvent[]): void {
    const queue = this.queues.get(accountId);
    if (queue) {
      queue.push(...events);
      return;
    }
    this.queues.set(accountId, [...events]);
  }

  private wakeAccount(accountId: number): void {
    this.wakePort?.wake(accountId);
  }
}

function requireFightId(fightId: string): string {
  return String(requireWireIdentity(Number(parseDecimalId(fightId, "fight id")), "fight id"));
}
