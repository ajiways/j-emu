import { randomBytes } from "node:crypto";
import { requireSafeWireInteger } from "../../../shared/kernel/decimal-id.ts";
import { Battle, type BattleRules } from "../domain/battle.ts";
import type { RandomSource } from "../domain/random-source.ts";
import type {
  CombatEvent,
  CombatPort,
  FightCommand,
  FightExit,
  FightStart,
} from "../ports/combat-port.ts";
import type { FightIdSource } from "../ports/fight-id-source.ts";

export class CombatService implements CombatPort {
  // In-progress battles live in process memory. Fight/participant IDs come from
  // PostgreSQL; a restart drops an unfinished battle. Completed hero/inventory
  // state is persisted by the owning modules.
  private readonly byAccount = new Map<string, Battle>();
  private readonly accountByFight = new Map<string, string>();
  private readonly queues = new Map<string, CombatEvent[]>();
  private readonly pendingExits = new Map<string, FightExit>();

  constructor(
    private readonly ids: FightIdSource,
    private readonly random: RandomSource,
    private readonly rules: BattleRules,
  ) {}

  async startHunt(input: {
    accountId: string;
    heroId: string;
    heroNick: string;
    heroHp: number;
    botId: number;
    botNick: string;
    botLevel: number;
    botHp: number;
    arena: string;
  }): Promise<FightStart> {
    if (this.byAccount.has(input.accountId)) throw new Error("Account already has an active fight");
    const fightId = await this.ids.nextFightId();
    const heroFightId = requireSafeWireInteger(
      await this.ids.nextParticipantId(),
      "participant id",
    );
    const accessKey = randomBytes(16).toString("hex");
    const battle = new Battle(
      fightId,
      accessKey,
      input.accountId,
      input.heroId,
      heroFightId,
      input.heroNick,
      input.botId,
      input.botNick,
      input.botLevel,
      input.heroHp,
      input.botHp,
      input.arena,
      this.rules,
      this.random,
    );
    this.byAccount.set(input.accountId, battle);
    this.accountByFight.set(fightId, input.accountId);
    return {
      fightId,
      accessKey,
      participantId: heroFightId,
      arena: input.arena,
    };
  }

  async execute(accountId: string, command: FightCommand) {
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
      this.pendingExits.set(accountId, {
        fightId: battle.id,
        winnerTeam: finished.winnerTeam,
      });
      this.byAccount.delete(accountId);
      this.accountByFight.delete(battle.id);
    }
    return [];
  }

  async activeFightId(accountId: string): Promise<string | null> {
    return this.byAccount.get(accountId)?.id ?? null;
  }

  async accountForFight(fightId: string): Promise<string | null> {
    const accountId = this.accountByFight.get(fightId);
    if (accountId === undefined) return null;
    return accountId;
  }

  async takeExit(accountId: string) {
    const value = this.pendingExits.get(accountId);
    if (!value) return null;
    this.pendingExits.delete(accountId);
    return value;
  }

  shutdown(): void {
    this.byAccount.clear();
    this.accountByFight.clear();
    this.queues.clear();
    this.pendingExits.clear();
  }

  private enqueue(accountId: string, events: readonly CombatEvent[]): void {
    const queue = this.queues.get(accountId);
    if (queue) {
      queue.push(...events);
      return;
    }
    this.queues.set(accountId, [...events]);
  }
}
