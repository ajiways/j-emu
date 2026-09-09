import { randomBytes } from "node:crypto";
import type { Clock } from "../../../shared/kernel/clock.ts";
import { requirePresent } from "../../../shared/kernel/require-present.ts";
import { parseDecimalId, requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { Battle, type BattleRules } from "../domain/battle.ts";
import { EphemeralBotFightIds } from "../domain/ephemeral-bot-fight-ids.ts";
import { FinishedFightConflictError } from "../domain/finished-fight-conflict-error.ts";
import { HuntJoinDenied } from "../domain/hunt-join-denied.ts";
import type { RandomSource } from "../domain/random-source.ts";
import type { FinishedFightRecorder } from "./finished-fight-recorder.ts";
import type { HistoryWriteObserver } from "./history-write-observer.ts";
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
  // In-progress battles live in process memory. Fight IDs come from PostgreSQL;
  // human participant IDs are heroes.id; bot IDs are RAM-only. One Battle may
  // hold several accounts. A restart drops an unfinished battle.
  private readonly byAccount = new Map<number, Battle>();
  private readonly battleByFight = new Map<string, Battle>();
  private readonly queues = new Map<number, CombatEvent[]>();
  private readonly pendingExits = new Map<number, FightExit>();
  private readonly botFightIds = new EphemeralBotFightIds();
  private terminal: FightTerminalObserver | undefined;

  constructor(
    private readonly ids: FightIdSource,
    private readonly random: RandomSource,
    private readonly rules: BattleRules,
    private readonly clock: Clock,
    private readonly history: FinishedFightRecorder,
    private readonly historyWrites: HistoryWriteObserver,
  ) {}

  bindTerminalObserver(observer: FightTerminalObserver): void {
    if (this.terminal) throw new Error("Fight terminal observer is already bound");
    this.terminal = requirePresent(observer, "Fight terminal observer is required");
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
      {
        fightId,
        accessKey,
        accountId: input.accountId,
        heroId: input.heroId,
        heroNick: input.heroNick,
        heroLevel: input.heroLevel,
        heroKind: input.heroKind,
        heroMp: input.heroMp,
        heroMaxMp: input.heroMaxMp,
        botArtikulId: input.botId,
        botFightId: this.botFightIds.allocate(input.heroId),
        botNick: input.botNick,
        botLevel: input.botLevel,
        botAvatar: input.botAvatar,
        botSk: input.botSk,
        botBody: input.botBody,
        playerHp: input.heroHp,
        playerMaxHp: input.heroMaxHp,
        botMaxHp: input.botHp,
        arena: input.arena,
        areaId: input.areaId,
        startedAt: this.clock.now(),
      },
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
    const battle = this.byAccount.get(accountId);
    if (!battle) throw new Error("Active fight not found");
    if (command.kind === "authenticate") {
      if (command.fightId !== battle.id) throw new Error("Fight id does not match active fight");
      this.enqueue(accountId, [
        { type: "command-accepted", sequence: command.sequence, accessKey: battle.accessKey },
        ...battle.authenticate(accountId),
      ]);
      return [];
    }
    const events = battle.strike(accountId, command.side);
    const first = events[0];
    if (!first) throw new Error("Battle produced no events for a strike");
    this.enqueue(accountId, [
      first,
      { type: "command-accepted", sequence: command.sequence },
      ...events.slice(1),
    ]);
    if (battle.finished) {
      await this.settleFinished(battle, events, accountId);
    }
    return [];
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
    this.byAccount.clear();
    this.battleByFight.clear();
    this.queues.clear();
    this.pendingExits.clear();
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
    await this.recordHistory(battle, finished.winnerTeam);
    const exit = { fightId: battle.id, winnerTeam: finished.winnerTeam };
    for (const accountId of battle.accountIds()) {
      if (accountId !== strikerAccountId) this.enqueue(accountId, [finished]);
      this.pendingExits.set(accountId, exit);
      this.byAccount.delete(accountId);
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
}

function requireFightId(fightId: string): string {
  return String(requireWireIdentity(Number(parseDecimalId(fightId, "fight id")), "fight id"));
}
