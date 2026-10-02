import { concentrate, type ConcentrationResult } from "./concentration.ts";
import { killCountsOf } from "./kill-counts.ts";
import type { BattleEvent, BotSnap } from "./battle-event.ts";
import {
  nextEffectDueMs,
  tickFightEffects,
  type EffectClockOutcome,
} from "./battle-effect-clock.ts";
import type { BattleRules } from "./battle-rules.ts";
import { authenticateFighter } from "./battle-authenticate.ts";
import { joinBattleHuman } from "./battle-join.ts";
import { huntHistoryOf, practiceHistoryOfRules, questChatOf } from "./battle-history.ts";
import {
  applyBattleAiTurn,
  applyBattleGlove,
  applyBattlePocket,
  applyBattlePlayerMelee,
  type BotTurnResult,
  type GloveCast,
  type PocketCast,
} from "./battle-actions.ts";
import {
  battleOpener,
  battlePairedOpponent,
  requireAuthedHuman,
  requireBattleHuman,
} from "./battle-lookups.ts";
import type { FightDuel } from "./fight-duel.ts";
import { fightDelayTokens, fightDuelDelayToken } from "./fight-delay-token.ts";
import { FightRules } from "./fight-rules.ts";
import type { FightSetup, FightSetupJoin } from "./fight-setup.ts";
import { Roster } from "./roster.ts";
import { requireFightBot, requireFightBots } from "./fight-bots.ts";
import type { BotFighter } from "./bot-fighter.ts";
import type { HumanFighter } from "./human-fighter.ts";
import { grantTurn as grantHumanTurn } from "./turn-grant.ts";
import { opposingTeam } from "./opposing-team.ts";
import { consumeStunSkip, timeoutBattleTurn } from "./battle-turn-skips.ts";
import type { HumanTimeout } from "./timeout-human-turn.ts";
import type { PlayerMeleeResult } from "./paired-melee.ts";
import { tryIdolCast } from "./idol-summon.ts";
import { tryRageCast, type KeepTurnResult } from "./player-casts.ts";
import type { EndingGloveResult } from "./glove-ending-cast.ts";
import { tryAggro, type AggroResult } from "./aggro.ts";
import { aiOnlyDuelTurns, pairWaitingSeekers, type AiDuelTurn } from "./battle-ai-duels.ts";
import type { RandomSource } from "./random-source.ts";
import { nextWaiterOfBattle, shuffleOfBattle, type NextWaiter } from "./battle-turnover.ts";
import { seedBattleParticipants } from "./battle-seed.ts";
import { battleOutcomeSnapshot, leaveWinnerTeam } from "./battle-outcome.ts";
import type { FightOutcomeKind, FightOutcomeSnapshot } from "./fight-outcome-snapshot.ts";
import type { ShuffleOutcome } from "./try-shuffle-after-hits.ts";
import { dissolveDuelContaining, requireDuelContaining } from "./pairing.ts";

export class Battle {
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
  readonly resultRevealDelayMs: number;
  private finishedValue = false;
  private readonly roster = new Roster();
  private readonly humans: HumanFighter[] = this.roster.humans;
  readonly bots: BotFighter[] = this.roster.bots;
  private readonly duels: FightDuel[] = [];

  constructor(
    readonly setup: FightSetup,
    private readonly rules: BattleRules,
    readonly fightRules: FightRules,
    private readonly random: RandomSource,
    /** Rolls who strikes first in the duel that opens the fight (the same source in play). */
    private readonly openingRandom: RandomSource,
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
    this.resultRevealDelayMs = rules.resultRevealDelayMs;
    const seed = seedBattleParticipants(setup, rules, fightRules, openingRandom);
    for (const participant of [...seed.humans, ...requireFightBots(seed.bots)]) {
      this.roster.add(participant);
    }
    this.duels.push(...seed.duels);
    for (const bot of this.bots) {
      bot.angerable = fightRules.canAggro && bot.team === fightRules.teamAssignment.enemyTeam;
    }
  }

  get accountId(): number {
    return battleOpener(this.humans).accountId;
  }
  get finished(): boolean {
    return this.finishedValue;
  }
  get hasBots(): boolean {
    return this.bots.length > 0;
  }
  get purpose(): "hunt" | "quest" | "friendly-duel" | "pvp" {
    return this.setup.meta.kind;
  }

  opposingTeamOf(accountId: number): 1 | 2 {
    return opposingTeam(requireBattleHuman(this.humans, accountId).team);
  }

  openerTeam(): 1 | 2 {
    return battleOpener(this.humans).team;
  }

  questChat(): Readonly<{ chatWin: string; chatLose: string }> {
    return questChatOf(this.setup, this.fightRules);
  }

  huntHistory() {
    return huntHistoryOf(this.humans, this.bots, this.fightRules);
  }

  practiceHistory() {
    return practiceHistoryOfRules(this.humans, this.fightRules);
  }

  accountIds(): readonly number[] {
    return this.humans.map((human) => human.accountId);
  }

  authedAccountIds(): readonly number[] {
    return this.humans
      .filter((human) => human.authed && !human.leftLive)
      .map((human) => human.accountId);
  }

  hasHuman(accountId: number, heroId: number): boolean {
    return this.humans.some((human) => human.accountId === accountId || human.heroId === heroId);
  }

  delayTokenFor(accountId: number): string | null {
    return this.duelTokenOfParticipant(requireBattleHuman(this.humans, accountId).heroId);
  }

  delayTokens(): readonly string[] {
    return fightDelayTokens(this.id, this.duels);
  }

  /** The participant whose turn is next in the duel `accountId` stands in. */
  nextActorIdOf(accountId: number): number {
    const human = requireBattleHuman(this.humans, accountId);
    return requireDuelContaining(this.duels, human.heroId).nextActorId;
  }

  /** The account controlling participant `id`; `null` for an AI participant. */
  accountOfParticipant(id: number): number | null {
    return this.humans.find((human) => human.heroId === id)?.accountId ?? null;
  }

  pairedOpponent(
    accountId: number,
  ): Readonly<{ kind: "human"; accountId: number } | { kind: "bot" }> {
    return battlePairedOpponent(this.humans, this.duels, this.bots, accountId);
  }

  foeBotSnap(accountId: number) {
    const human = requireBattleHuman(this.humans, accountId);
    return requireFightBot(
      this.bots,
      requireDuelContaining(this.duels, human.heroId).otherId(human.heroId),
    ).snap();
  }

  addHuman(join: FightSetupJoin): BattleEvent {
    return joinBattleHuman({
      ...this.actionState(),
      enemyTeam: this.fightRules.teamAssignment.enemyTeam,
      join,
      hasHuman: (accountId, heroId) => this.hasHuman(accountId, heroId),
      effectIds: battleOpener(this.humans).effects.effectIds,
      add: (human) => this.roster.add(human),
    });
  }

  authenticate(accountId: number, nowMs: number): readonly BattleEvent[] {
    return authenticateFighter({
      ...this.actionState(),
      enemyTeam: this.fightRules.teamAssignment.enemyTeam,
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

  tryPocket(accountId: number, pocket: PocketCast, nowMs: number): KeepTurnResult {
    return applyBattlePocket(this.actionState(), accountId, pocket, nowMs);
  }

  tryIdol(
    accountId: number,
    itemId: number,
    sequence: string | number,
    allocateBotId: () => number,
  ): KeepTurnResult {
    const human = requireAuthedHuman(this.humans, accountId);
    return tryIdolCast({ ...this.actionState(), human, itemId, sequence, allocateBotId });
  }

  /** «Концентрация» of a player who waits for a foe; `null` while it cannot be used. */
  tryConcentration(accountId: number, nowMs: number): ConcentrationResult | null {
    const actor = requireAuthedHuman(this.humans, accountId);
    const result = concentrate({ ...this.actionState(), actor, nowMs });
    if (result?.fallout.finished) this.finishedValue = true;
    return result;
  }

  tryRage(accountId: number): KeepTurnResult {
    return tryRageCast(requireAuthedHuman(this.humans, accountId));
  }

  tryAggro(accountId: number, targetId: number, allocateBotId: () => number): AggroResult {
    return tryAggro({
      ...this.actionState(),
      canAggro: this.fightRules.canAggro,
      enemyTeam: this.fightRules.teamAssignment.enemyTeam,
      accountId,
      targetId,
      allocateBotId,
      addBot: (bot) => {
        bot.angerable = true;
        this.roster.add(bot);
      },
    });
  }

  tryGlove(accountId: number, glove: GloveCast, nowMs: number): KeepTurnResult | EndingGloveResult {
    const applied = applyBattleGlove(this.actionState(), accountId, glove, nowMs);
    if (applied.finished) this.finishedValue = true;
    return applied.result;
  }

  resolveAiTurn(botId: number, nowMs: number): BotTurnResult {
    const result = applyBattleAiTurn(this.actionState(), botId, nowMs);
    if (result.finished) this.finishedValue = true;
    return result;
  }

  /** What starts without a click: the waiting paired now, and the turns of mob-only duels. */
  startIdleWork(): Readonly<{ paired: readonly number[]; turns: readonly AiDuelTurn[] }> {
    if (this.finishedValue) return { paired: [], turns: [] };
    const paired = pairWaitingSeekers(this.actionState());
    return { paired, turns: aiOnlyDuelTurns(this.actionState()) };
  }

  duelTokenOfParticipant(participantId: number): string | null {
    const duel = this.duels.find((entry) => entry.has(participantId));
    return duel ? fightDuelDelayToken(this.id, duel) : null;
  }

  /** Whoever stands across from player `accountId`; `null` while he waits. */
  foeIdOf(accountId: number): number | null {
    const heroId = requireBattleHuman(this.humans, accountId).heroId;
    return this.duels.find((entry) => entry.has(heroId))?.otherId(heroId) ?? null;
  }

  nextEffectDueMs(): number | null {
    return this.finishedValue ? null : nextEffectDueMs([...this.humans, ...this.bots]);
  }

  tickDueEffects(nowMs: number): EffectClockOutcome {
    if (this.finishedValue) throw new Error("Cannot tick effects of a finished battle");
    const outcome = tickFightEffects({ ...this.actionState(), nowMs });
    if (outcome.finished) this.finishedValue = true;
    return outcome;
  }

  tryShuffleAfterHits(accountId: number): ShuffleOutcome {
    return shuffleOfBattle(this.actionState(), accountId);
  }

  timeoutTurn(accountId: number, nowMs: number): HumanTimeout | null {
    const result = timeoutBattleTurn({ ...this.actionState(), accountId, nowMs });
    if (result?.finished) this.finishedValue = true;
    return result ? result.timeout : null;
  }

  consumeStunSkip(accountId: number): readonly BattleEvent[] | null {
    return consumeStunSkip(requireBattleHuman(this.humans, accountId));
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
    return battleOutcomeSnapshot({ ...this.actionState(), setup: this.setup, kind, winnerTeam });
  }

  boardParticipants(): Readonly<{
    humans: readonly HumanFighter[];
    bots: readonly BotSnap[];
  }> {
    return { humans: this.humans, bots: this.bots.map((bot) => bot.snap()) };
  }

  killCounts(): ReadonlyMap<number, number> {
    return killCountsOf(this.roster.all());
  }

  livingHumans(): readonly HumanFighter[] {
    return this.humans.filter((human) => !human.leftLive && human.hp > 0);
  }

  /** A fallen player may always walk out; the ban of a fight holds for those still fighting. */
  leaveAllowed(accountId: number): boolean {
    const fighting = this.livingHumans().some((human) => human.accountId === accountId);
    return this.finishedValue || this.fightRules.canLeave || !fighting;
  }

  markHumanLeft(accountId: number): HumanFighter {
    const human = requireBattleHuman(this.humans, accountId);
    human.markLeft();
    return human;
  }

  finishLeave(): 1 | 2 {
    if (this.finishedValue) throw new Error("Cannot leave a finished battle");
    this.finishedValue = true;
    return leaveWinnerTeam(this.humans);
  }

  pairNextWaiter(previousAccountId: number): NextWaiter | null {
    return nextWaiterOfBattle(this.actionState(), previousAccountId);
  }

  dissolveDuelOf(accountId: number): void {
    const human = requireBattleHuman(this.humans, accountId);
    dissolveDuelContaining(this.duels, this.roster.all(), human.heroId);
  }

  private actionState() {
    return {
      fightRules: this.fightRules,
      finished: this.finishedValue,
      roster: this.roster,
      duels: this.duels,
      rules: this.rules,
      random: this.random,
      openingRandom: this.openingRandom,
      fightId: this.id,
    };
  }
}
