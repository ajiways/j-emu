import type { BattleEvent, HuntBotSnap } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import { authenticateFighter } from "./battle-authenticate.ts";
import { huntHistoryOf, joinBattleHuman } from "./battle-hunt-join.ts";
import { practiceHistoryOf } from "./practice-fight-history.ts";
import {
  applyBattleBotMelee,
  applyBattleGlove,
  applyBattlePlayerMelee,
} from "./battle-hunt-actions.ts";
import {
  battleOpener,
  battlePairedOpponent,
  huntPairingOf,
  requireAuthedHuman,
  requireBattleHuman,
  requireBattleHuntRoster,
} from "./battle-lookups.ts";
import type { FightDuel } from "./fight-duel.ts";
import { fightDelayTokens, fightDuelDelayToken } from "./fight-delay-token.ts";
import { FightRules } from "./fight-rules.ts";
import type { FightSetup, FightSetupJoin } from "./fight-setup.ts";
import type { HuntRoster } from "./hunt-roster.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { grantTurn as grantHumanTurn, type BotMeleeResult } from "./hunt-melee.ts";
import type { PlayerMeleeResult } from "./paired-melee.ts";
import { tryPocketCast, tryRageCast, type KeepTurnResult } from "./hunt-cast.ts";
import type { EndingGloveResult } from "./glove-ending-cast.ts";
import { tryHuntAggro, type HuntAggroResult } from "./hunt-aggro.ts";
import { tickHuntRosterDuels } from "./battle-hunt-runtime.ts";
import type { RandomSource } from "./random-source.ts";
import { pairNextHuntWaiter, shuffleHuntAfterHits } from "./battle-pairing.ts";
import { seedBattleParticipants } from "./battle-seed.ts";
import { battleOutcomeSnapshot, leaveWinnerTeam } from "./battle-outcome.ts";
import type { FightOutcomeKind, FightOutcomeSnapshot } from "./fight-outcome-snapshot.ts";
import type { ShuffleOutcome } from "./try-shuffle-after-hits.ts";
import { dissolveDuelContaining, requireDuelContaining } from "./try-pair-hunt-queues.ts";

export class Battle {
  readonly kind: "hunt" | "friendly-duel" | "pvp";
  readonly id: string;
  readonly accessKey: string;
  readonly arena: string;
  readonly areaId: string;
  readonly instanceCopyId: number | null;
  readonly fightFlags: string | null;
  readonly startedAt: Date;
  readonly turnTimeoutSeconds: number;
  readonly meleeBotCounterMs: number;
  readonly turnGrantDelayMs: number;
  private finishedValue = false;
  private pairedAccountIdValue: number;
  private readonly humans: HuntHuman[] = [];
  private readonly duels: FightDuel[] = [];
  readonly huntRoster: HuntRoster | null;

  constructor(
    readonly setup: FightSetup,
    private readonly rules: BattleRules,
    readonly fightRules: FightRules,
    private readonly random: RandomSource,
  ) {
    FightRules.require(fightRules);
    this.id = setup.meta.fightId;
    this.accessKey = setup.meta.accessKey;
    this.arena = setup.meta.arena;
    this.areaId = setup.meta.areaId;
    this.instanceCopyId = setup.meta.instanceCopyId;
    this.fightFlags = setup.meta.fightFlags;
    this.startedAt = setup.meta.startedAt;
    this.turnTimeoutSeconds = rules.turnTimeoutSeconds;
    this.meleeBotCounterMs = rules.meleeBotCounterMs;
    this.turnGrantDelayMs = rules.turnGrantDelayMs;
    const seed = seedBattleParticipants(setup, rules, fightRules);
    this.kind = seed.kind;
    this.huntRoster = seed.huntRoster;
    this.pairedAccountIdValue = seed.pairedAccountId;
    this.humans.push(...seed.humans);
    this.duels.push(...seed.duels);
  }

  get accountId(): number {
    return battleOpener(this.humans).accountId;
  }
  get pairedAccountId(): number {
    return this.pairedAccountIdValue;
  }
  get finished(): boolean {
    return this.finishedValue;
  }
  get purpose(): "hunt" | "quest" | "friendly-duel" | "pvp" {
    return this.setup.meta.kind;
  }

  openerTeam(): 1 | 2 {
    return battleOpener(this.humans).team;
  }

  questChat(): Readonly<{ chatWin: string; chatLose: string }> {
    const kind = this.setup.meta.kind;
    if (kind !== "hunt" && kind !== "quest") {
      throw new Error("Quest chat is only available for hunt or quest fights");
    }
    return { chatWin: this.setup.meta.chatWin, chatLose: this.setup.meta.chatLose };
  }

  huntHistory() {
    return huntHistoryOf(battleOpener(this.humans), requireBattleHuntRoster(this.huntRoster));
  }

  practiceHistory() {
    if (this.fightRules.historyRow !== "practice-humans") {
      throw new Error("Practice history is only available for a friendly duel");
    }
    return practiceHistoryOf(this.humans);
  }

  accountIds(): readonly number[] {
    return this.humans.map((human) => human.accountId);
  }

  authedAccountIds(): readonly number[] {
    return this.humans.filter((human) => human.authed).map((human) => human.accountId);
  }

  hasHuman(accountId: number, heroId: number): boolean {
    return this.humans.some((human) => human.accountId === accountId || human.heroId === heroId);
  }

  delayTokenFor(accountId: number): string | null {
    const human = requireBattleHuman(this.humans, accountId);
    const duel = this.duels.find((entry) => entry.has(human.heroId));
    return duel ? fightDuelDelayToken(this.id, duel) : null;
  }

  delayTokens(): readonly string[] {
    return fightDelayTokens(this.id, this.duels);
  }

  nextActorAccountId(accountId: number): number {
    const human = requireBattleHuman(this.humans, accountId);
    const actorId = requireDuelContaining(this.duels, human.heroId).nextActorId;
    const actor = this.humans.find((entry) => entry.heroId === actorId);
    if (!actor) throw new Error("Duel next actor is not a human in this battle");
    return actor.accountId;
  }

  opponentAccountId(accountId: number): number {
    const opponent = this.pairedOpponent(accountId);
    if (opponent.kind !== "human") {
      throw new Error("Duel opponent is not a human in this battle");
    }
    return opponent.accountId;
  }

  pairedOpponent(
    accountId: number,
  ): Readonly<{ kind: "human"; accountId: number } | { kind: "bot" }> {
    return battlePairedOpponent(this.humans, this.duels, this.huntRoster, accountId);
  }

  foeBotSnap(accountId: number) {
    const human = requireBattleHuman(this.humans, accountId);
    return requireBattleHuntRoster(this.huntRoster)
      .bot(requireDuelContaining(this.duels, human.heroId).otherId(human.heroId))
      .snap();
  }

  humanOpensDuel(accountId: number): boolean {
    const human = requireBattleHuman(this.humans, accountId);
    return requireDuelContaining(this.duels, human.heroId).nextActorId === human.heroId;
  }

  addHuman(join: FightSetupJoin): BattleEvent {
    return joinBattleHuman({
      fightRules: this.fightRules,
      finished: this.finishedValue,
      humans: this.humans,
      huntRoster: this.huntRoster,
      join,
      hasHuman: (accountId, heroId) => this.hasHuman(accountId, heroId),
      duels: this.duels,
      random: this.random,
      effectIds: battleOpener(this.humans).effects.effectIds,
    });
  }

  authenticate(accountId: number, nowMs: number): readonly BattleEvent[] {
    return authenticateFighter({
      finished: this.finishedValue,
      humans: this.humans,
      duels: this.duels,
      huntRoster: this.huntRoster,
      timeoutSeconds: this.rules.turnTimeoutSeconds,
      accountId,
      nowMs,
    });
  }

  prepareResume(accountId: number): void {
    if (this.finishedValue) throw new Error("Cannot resume a finished battle");
    const human = requireBattleHuman(this.humans, accountId);
    const wasAuthed = human.authed;
    human.authed = false;
    if (wasAuthed) human.markResume();
  }

  heroIdFor(accountId: number): number {
    return requireBattleHuman(this.humans, accountId).heroId;
  }

  tryPlayerMelee(
    accountId: number,
    side: "left" | "center" | "right",
    nowMs: number,
  ): PlayerMeleeResult {
    const applied = applyBattlePlayerMelee(this.actionState(), accountId, side, nowMs);
    if (applied.finished) this.finishedValue = true;
    return applied.result;
  }

  tryPocket(
    accountId: number,
    itemId: number,
    nowMs: number,
    sequence: string | number,
  ): KeepTurnResult {
    return tryPocketCast(requireAuthedHuman(this.humans, accountId), itemId, nowMs, sequence);
  }

  tryRage(accountId: number): KeepTurnResult {
    return tryRageCast(requireAuthedHuman(this.humans, accountId));
  }

  tryAggro(accountId: number, targetId: number, allocateBotId: () => number): HuntAggroResult {
    return tryHuntAggro({
      canAggro: this.fightRules.canAggro,
      finished: this.finishedValue,
      humans: this.humans,
      duels: this.duels,
      roster: this.huntRoster,
      random: this.random,
      accountId,
      targetId,
      allocateBotId,
    });
  }

  tryGlove(
    accountId: number,
    spellId: number,
    sequence: string | number,
    nowMs: number,
  ): KeepTurnResult | EndingGloveResult {
    const applied = applyBattleGlove(this.actionState(), accountId, spellId, sequence, nowMs);
    if (applied.finished) this.finishedValue = true;
    return applied.result;
  }

  resolveBotMelee(accountId: number): BotMeleeResult {
    const result = applyBattleBotMelee(this.actionState(), accountId, this.livingHumans());
    if (result.finished) this.finishedValue = true;
    return result;
  }

  tickRosterDuels(): readonly BattleEvent[] {
    const ticked = tickHuntRosterDuels({
      roster: this.huntRoster,
      duels: this.duels,
      finished: this.finishedValue,
      opener: battleOpener(this.humans),
      humans: this.humans,
      fightId: this.id,
      rules: this.rules,
      random: this.random,
    });
    if (ticked.finished) this.finishedValue = true;
    return ticked.events;
  }

  tryShuffleAfterHits(accountId: number): ShuffleOutcome {
    if (!this.fightRules.shufflesAfterHits) return { kind: "none" };
    const human = requireBattleHuman(this.humans, accountId);
    const duel = this.duels.find((entry) => entry.has(human.heroId));
    if (!duel) return { kind: "none" };
    const pairing = huntPairingOf(duel, this.humans, accountId);
    const result = shuffleHuntAfterHits({
      pairing,
      openerTeam: this.fightRules.teamAssignment.openerTeam,
      roster: requireBattleHuntRoster(this.huntRoster),
      duels: this.duels,
      finished: this.finishedValue,
    });
    this.pairedAccountIdValue = pairing.pairedAccountId;
    return result;
  }

  countPairHit(accountId: number): void {
    const human = requireBattleHuman(this.humans, accountId);
    requireDuelContaining(this.duels, human.heroId).addHit(human.heroId);
  }

  grantTurn(accountId: number, nowMs: number): BattleEvent | null {
    if (this.finishedValue) return null;
    return grantHumanTurn(
      requireBattleHuman(this.humans, accountId),
      this.rules.turnTimeoutSeconds,
      nowMs,
    );
  }

  outcome(kind: FightOutcomeKind, winnerTeam: 1 | 2): FightOutcomeSnapshot {
    return battleOutcomeSnapshot({
      setup: this.setup,
      fightId: this.id,
      kind,
      winnerTeam,
      humans: this.humans,
      fightRules: this.fightRules,
    });
  }

  boardParticipants(): Readonly<{
    humans: readonly HuntHuman[];
    bots: readonly HuntBotSnap[];
  }> {
    return { humans: this.humans, bots: this.huntRoster?.snaps() ?? [] };
  }

  livingHumans(): readonly HuntHuman[] {
    return this.humans.filter((human) => !human.leftLive && human.hp > 0);
  }

  markHumanLeft(accountId: number): HuntHuman {
    const human = requireBattleHuman(this.humans, accountId);
    human.markLeft();
    return human;
  }

  finishLeave(): 1 | 2 {
    if (this.finishedValue) throw new Error("Cannot leave a finished battle");
    this.finishedValue = true;
    return leaveWinnerTeam(this.humans);
  }

  pairNextWaiter(previousAccountId: number): Readonly<{
    accountId: number;
    authed: boolean;
    events: readonly BattleEvent[];
  }> | null {
    if (!this.fightRules.pairsNextWaiter) return null;
    const previous = requireBattleHuman(this.humans, previousAccountId);
    const duel = this.duels.find((entry) => entry.has(previous.heroId));
    if (!duel) return null;
    const pairing = huntPairingOf(duel, this.humans, previousAccountId);
    const roster = requireBattleHuntRoster(this.huntRoster);
    const result = pairNextHuntWaiter({
      pairing,
      roster,
      openerTeam: this.fightRules.teamAssignment.openerTeam,
      enemyTeam: this.fightRules.teamAssignment.enemyTeam,
      botHp: roster.primary.hp,
      finished: this.finishedValue,
    });
    this.pairedAccountIdValue = pairing.pairedAccountId;
    return result;
  }

  dissolveDuelOf(accountId: number): void {
    const human = requireBattleHuman(this.humans, accountId);
    dissolveDuelContaining(this.duels, this.humans, human.heroId, this.huntRoster);
  }

  private actionState() {
    return {
      fightRules: this.fightRules,
      finished: this.finishedValue,
      humans: this.humans,
      duels: this.duels,
      huntRoster: this.huntRoster,
      rules: this.rules,
      random: this.random,
      fightId: this.id,
    };
  }
}
