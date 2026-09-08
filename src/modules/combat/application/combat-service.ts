import { randomBytes } from "node:crypto";
import type { Clock } from "../../../shared/kernel/clock.ts";
import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { Battle, type BattleRules } from "../domain/battle.ts";
import { EphemeralBotFightIds } from "../domain/ephemeral-bot-fight-ids.ts";
import { FinishedFightConflictError } from "../domain/finished-fight-conflict-error.ts";
import type { RandomSource } from "../domain/random-source.ts";
import type { FinishedFightRecorder } from "./finished-fight-recorder.ts";
import type { HistoryWriteObserver } from "./history-write-observer.ts";
import type {
  CombatEvent,
  CombatPort,
  FightCommand,
  FightExit,
  FightStart,
} from "../ports/combat-port.ts";
import type { FightIdSource } from "../ports/fight-id-source.ts";

export class CombatService implements CombatPort {
  // In-progress battles live in process memory. Fight IDs come from PostgreSQL;
  // human participant IDs are heroes.id; bot IDs are RAM-only. A restart drops
  // an unfinished battle. History is best-effort after a terminal outcome.
  private readonly byAccount = new Map<number, Battle>();
  private readonly accountByFight = new Map<string, number>();
  private readonly queues = new Map<number, CombatEvent[]>();
  private readonly pendingExits = new Map<number, FightExit>();
  private readonly botFightIds = new EphemeralBotFightIds();

  constructor(
    private readonly ids: FightIdSource,
    private readonly random: RandomSource,
    private readonly rules: BattleRules,
    private readonly clock: Clock,
    private readonly history: FinishedFightRecorder,
    private readonly historyWrites: HistoryWriteObserver,
  ) {}

  async startHunt(input: {
    accountId: number;
    heroId: number;
    heroNick: string;
    heroLevel: number;
    heroKind: number;
    heroHp: number;
    botId: number;
    botNick: string;
    botLevel: number;
    botHp: number;
    arena: string;
    areaId: string;
  }): Promise<FightStart> {
    requireWireIdentity(input.accountId, "account id");
    requireWireIdentity(input.heroId, "hero id");
    if (this.byAccount.has(input.accountId)) throw new Error("Account already has an active fight");
    const fightId = await this.ids.nextFightId();
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
        botArtikulId: input.botId,
        botFightId: this.botFightIds.allocate(input.heroId),
        botNick: input.botNick,
        botLevel: input.botLevel,
        playerMaxHp: input.heroHp,
        botMaxHp: input.botHp,
        arena: input.arena,
        areaId: input.areaId,
        startedAt: this.clock.now(),
      },
      this.rules,
      this.random,
    );
    this.byAccount.set(input.accountId, battle);
    this.accountByFight.set(fightId, input.accountId);
    return {
      fightId,
      accessKey,
      participantId: input.heroId,
      arena: input.arena,
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
        ...battle.authenticate(),
      ]);
      return [];
    }
    const events = battle.strike(command.side);
    const first = events[0];
    if (!first) throw new Error("Battle produced no events for a strike");
    this.enqueue(accountId, [
      first,
      { type: "command-accepted", sequence: command.sequence },
      ...events.slice(1),
    ]);
    if (battle.finished) {
      const finished = events.find((event) => event.type === "finished");
      if (!finished || finished.type !== "finished") {
        throw new Error("Finished battle did not produce a finished event");
      }
      await this.recordHistory(battle, finished.winnerTeam);
      this.pendingExits.set(accountId, {
        fightId: battle.id,
        winnerTeam: finished.winnerTeam,
      });
      this.byAccount.delete(accountId);
      this.accountByFight.delete(battle.id);
    }
    return [];
  }

  async activeFightId(accountId: number): Promise<string | null> {
    return this.byAccount.get(accountId)?.id ?? null;
  }

  async accountForFight(fightId: string): Promise<number | null> {
    const accountId = this.accountByFight.get(fightId);
    if (accountId === undefined) return null;
    return accountId;
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
    this.accountByFight.clear();
    this.queues.clear();
    this.pendingExits.clear();
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
