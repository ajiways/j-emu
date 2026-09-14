import { randomBytes } from "node:crypto";
import type { Clock } from "../../../shared/kernel/clock.ts";
import { requirePresent } from "../../../shared/kernel/require-present.ts";
import { parseDecimalId, requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { Battle } from "../domain/battle.ts";
import type { BattleRules } from "../domain/battle-rules.ts";
import { EphemeralBotFightIds } from "../domain/ephemeral-bot-fight-ids.ts";
import { HuntJoinDenied } from "../domain/hunt-join-denied.ts";
import { FIGHT_LEAVE_DENIED, fightLeaveDenied } from "../domain/fight-leave-denied.ts";
import type { RandomSource } from "../domain/random-source.ts";
import type { CombatDelay } from "../ports/combat-delay.ts";
import type { CombatWake } from "../ports/combat-wake.ts";
import type { FinishedFightRecorder } from "./finished-fight-recorder.ts";
import type { HistoryWriteObserver } from "./history-write-observer.ts";
import { CombatMeleeLoop } from "./combat-melee-loop.ts";
import { CombatTerminal } from "./combat-terminal.ts";
import { createHuntBattle } from "./create-hunt-battle.ts";
import { HuntMeleeScheduler } from "./hunt-melee-scheduler.ts";
import { startHumanDuelBattle } from "./start-human-duel.ts";
import { fightStartOf } from "./fight-start-of.ts";
import { castFightSpecial } from "./combat-special-casts.ts";
import type {
  CombatEvent,
  CombatPort,
  FightCommand,
  FightExit,
  FightStart,
  FriendlyDuelStartInput,
  HuntJoinInput,
  HuntStartInput,
} from "../ports/combat-port.ts";
import type { FightIdSource } from "../ports/fight-id-source.ts";
import type { FightSettlement } from "../ports/fight-settlement.ts";
import type { FightTerminalObserver } from "../ports/fight-terminal-observer.ts";
import type { FightLootBlock } from "../domain/fight-loot-block.ts";

export class CombatService implements CombatPort {
  private readonly byAccount = new Map<number, Battle>();
  private readonly battleByFight = new Map<string, Battle>();
  private readonly queues = new Map<number, CombatEvent[]>();
  private readonly pendingExits = new Map<number, FightExit>();
  private readonly pendingLoot = new Map<number, FightLootBlock>();
  private readonly pendingPocketConsume = new Map<number, number>();
  private readonly settledFights = new Set<string>();
  private readonly exitSent = new Set<string>();
  private readonly botFightIds = new EphemeralBotFightIds();
  private readonly scheduler: HuntMeleeScheduler;
  private readonly melee: CombatMeleeLoop;
  private readonly finish: CombatTerminal;
  private terminal: FightTerminalObserver | undefined;
  private settlement: FightSettlement | undefined;
  private wakePort: CombatWake | undefined;

  constructor(
    private readonly ids: FightIdSource,
    private readonly random: RandomSource,
    private readonly rules: BattleRules,
    clock: Clock,
    history: FinishedFightRecorder,
    historyWrites: HistoryWriteObserver,
    delay: CombatDelay,
    private readonly testBotStrength?: number,
  ) {
    this.scheduler = new HuntMeleeScheduler(delay, clock);
    this.melee = new CombatMeleeLoop(
      this.byAccount,
      this.battleByFight,
      this.scheduler,
      (accountId, events) => this.enqueue(accountId, events),
      (accountId) => this.wakeAccount(accountId),
      (battle, events, strikerAccountId) =>
        this.finish.settleFinished(battle, events, strikerAccountId),
      (battle, accountId) => this.finish.departHuman(battle, accountId),
      (accountId, fightId, exit) => this.finish.queueExit(accountId, fightId, exit),
    );
    this.finish = new CombatTerminal(
      this.byAccount,
      this.battleByFight,
      this.pendingExits,
      this.pendingLoot,
      this.settledFights,
      this.exitSent,
      this.scheduler,
      this.melee,
      history,
      historyWrites,
      (accountId, events) => this.enqueue(accountId, events),
      (accountId) => this.wakeAccount(accountId),
      () => this.settlement,
      () => this.terminal,
    );
  }

  bindTerminalObserver(observer: FightTerminalObserver): void {
    if (this.terminal) throw new Error("Fight terminal observer is already bound");
    this.terminal = requirePresent(observer, "Fight terminal observer is required");
  }

  bindSettlement(settlement: FightSettlement): void {
    if (this.settlement) throw new Error("Fight settlement is already bound");
    this.settlement = requirePresent(settlement, "Fight settlement is required");
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
    if (input.purpose !== "hunt" && input.purpose !== "quest") {
      throw new Error("Hunt fight purpose must be hunt or quest");
    }
    if (this.byAccount.has(input.accountId)) throw new Error("Account already has an active fight");
    const fightId = requireFightId(input.fightId);
    if (this.battleByFight.has(fightId)) throw new Error(`Fight ${fightId} is already active`);
    const accessKey = randomBytes(16).toString("hex");
    const battle = createHuntBattle(
      { ...input, fightId },
      accessKey,
      this.botFightIds,
      this.scheduler.now(),
      this.testBotStrength,
      this.rules,
      this.random,
    );
    this.byAccount.set(input.accountId, battle);
    this.battleByFight.set(fightId, battle);
    return fightStartOf(battle, input.heroId);
  }

  async startFriendlyDuel(input: FriendlyDuelStartInput): Promise<FightStart> {
    return this.startHumanDuel(input, "friendly-duel");
  }

  async startPvp(input: FriendlyDuelStartInput): Promise<FightStart> {
    return this.startHumanDuel(input, "pvp");
  }

  async joinHunt(input: HuntJoinInput): Promise<FightStart> {
    requireWireIdentity(input.accountId, "account id");
    requireWireIdentity(input.heroId, "hero id");
    if (input.team !== 1 && input.team !== 2) throw new Error("Hunt join team must be 1 or 2");
    if (this.byAccount.has(input.accountId)) throw new HuntJoinDenied("уже в бою");
    const fightId = requireFightId(input.fightId);
    const battle = this.battleByFight.get(fightId);
    if (!battle || battle.finished) throw new HuntJoinDenied("бой не найден");
    if (battle.kind === "friendly-duel") throw new HuntJoinDenied("нельзя вмешаться в дуэль");
    if (battle.purpose === "quest") throw new HuntJoinDenied("нельзя вмешаться в квестовый бой");
    if (battle.areaId !== input.areaId || battle.instanceCopyId !== input.instanceCopyId) {
      throw new HuntJoinDenied("бой в другой локации");
    }
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
      strength: input.heroStrength,
      initiative: input.heroInitiative,
      rage: input.heroRage,
      dexterity: input.heroDexterity,
      defense: input.heroDefense,
      block: input.heroBlock,
      aggroCharges: input.heroAggroCharges,
      magPower: input.heroMagPower,
      magResist: input.heroMagResist,
      team: input.team,
      appearance: input.appearance,
      startedAtMs: this.scheduler.now().getTime(),
    });
    this.byAccount.set(input.accountId, battle);
    for (const accountId of battle.authedAccountIds()) {
      if (accountId === input.accountId) continue;
      this.enqueue(accountId, [roster]);
    }
    this.melee.notifyJoinedPair(battle, input.accountId);
    return fightStartOf(battle, input.heroId);
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
        ...battle.authenticate(accountId, this.scheduler.now().getTime()),
      ]);
      return [];
    }
    if (command.kind === "strike") {
      await this.melee.strike(accountId, command.side, command.sequence);
      return [];
    }
    if (command.kind === "leave") {
      const battle = this.byAccount.get(accountId);
      if (battle && !battle.finished && fightLeaveDenied(battle.purpose, battle.instanceCopyId)) {
        return [
          { type: "command-denied" as const, sequence: command.sequence, err: FIGHT_LEAVE_DENIED },
        ];
      }
      await this.finish.leaveFight(accountId);
      return [{ type: "command-accepted" as const, sequence: command.sequence }];
    }
    await castFightSpecial({
      accountId,
      command,
      battle: this.byAccount.get(accountId),
      nowMs: this.scheduler.now().getTime(),
      botFightIds: this.botFightIds,
      melee: this.melee,
      pendingPocketConsume: this.pendingPocketConsume,
      enqueue: (id, events) => this.enqueue(id, events),
    });
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

  async participantTeam(accountId: number): Promise<1 | 2 | null> {
    requireWireIdentity(accountId, "account id");
    const battle = this.byAccount.get(accountId);
    if (!battle || battle.finished) return null;
    const human = battle.livingHumans().find((entry) => entry.accountId === accountId);
    return human === undefined ? null : human.team;
  }

  async resumeFight(accountId: number): Promise<FightStart | null> {
    requireWireIdentity(accountId, "account id");
    const battle = this.byAccount.get(accountId);
    if (!battle || battle.finished) return null;
    this.queues.delete(accountId);
    battle.prepareResume(accountId);
    return fightStartOf(battle, battle.heroIdFor(accountId));
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

  async takeLoot(accountId: number) {
    const value = this.pendingLoot.get(accountId);
    if (!value) return null;
    this.pendingLoot.delete(accountId);
    return value;
  }

  async peekLoot(accountId: number) {
    return this.pendingLoot.get(accountId) ?? null;
  }

  shutdown(): void {
    for (const battle of this.battleByFight.values()) {
      for (const token of battle.delayTokens()) this.scheduler.cancel(token);
    }
    this.byAccount.clear();
    this.battleByFight.clear();
    this.queues.clear();
    this.pendingExits.clear();
    this.pendingLoot.clear();
    this.pendingPocketConsume.clear();
    this.settledFights.clear();
    this.exitSent.clear();
  }

  private startHumanDuel(input: FriendlyDuelStartInput, kind: "friendly-duel" | "pvp"): FightStart {
    requireWireIdentity(input.challenger.accountId, "challenger account id");
    requireWireIdentity(input.acceptor.accountId, "acceptor account id");
    requireWireIdentity(input.challenger.heroId, "challenger hero id");
    requireWireIdentity(input.acceptor.heroId, "acceptor hero id");
    return startHumanDuelBattle(input, kind, {
      byAccount: this.byAccount,
      battleByFight: this.battleByFight,
      rules: this.rules,
      random: this.random,
      now: this.scheduler.now(),
      requireFightId,
    });
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
