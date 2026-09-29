import type { BattleEvent, HuntBotSnap } from "./battle-event.ts";
import {
  nextEffectDueMs,
  tickFightEffects,
  type EffectClockOutcome,
} from "./battle-effect-clock.ts";
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
} from "./battle-lookups.ts";
import type { FightDuel } from "./fight-duel.ts";
import { fightDelayTokens, fightDuelDelayToken } from "./fight-delay-token.ts";
import { FightRules } from "./fight-rules.ts";
import type { FightSetup, FightSetupJoin } from "./fight-setup.ts";
import { primaryEnemyBot, requireFightBot, requireFightBots } from "./fight-bots.ts";
import type { HuntRosterBot } from "./hunt-roster-bot.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { grantTurn as grantHumanTurn, type BotMeleeResult } from "./hunt-melee.ts";
import { opposingTeam } from "./opposing-team.ts";
import { rosterIsPvp } from "./roster-pvp.ts";
import { consumeStunSkip, timeoutBattleTurn } from "./battle-turn-skips.ts";
import type { HumanTimeout } from "./timeout-human-turn.ts";
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
  private readonly humans: HuntHuman[] = [];
  private readonly duels: FightDuel[] = [];
  readonly bots: HuntRosterBot[];

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
    this.resultRevealDelayMs = rules.resultRevealDelayMs;
    const seed = seedBattleParticipants(setup, rules, fightRules);
    this.bots = requireFightBots(seed.bots);
    this.humans.push(...seed.humans);
    this.duels.push(...seed.duels);
  }

  get accountId(): number {
    return battleOpener(this.humans).accountId;
  }
  get finished(): boolean {
    return this.finishedValue;
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
    if (!this.fightRules.includesQuestChat) {
      throw new Error("Quest chat requires FightRules.includesQuestChat");
    }
    return { chatWin: this.setup.meta.chatWin, chatLose: this.setup.meta.chatLose };
  }

  huntHistory() {
    return huntHistoryOf(
      battleOpener(this.humans),
      primaryEnemyBot(this.bots, this.fightRules.teamAssignment.enemyTeam),
    );
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

  humanOpensDuel(accountId: number): boolean {
    const human = requireBattleHuman(this.humans, accountId);
    return requireDuelContaining(this.duels, human.heroId).nextActorId === human.heroId;
  }

  addHuman(join: FightSetupJoin): BattleEvent {
    return joinBattleHuman({
      ...this.actionState(),
      enemyTeam: this.fightRules.teamAssignment.enemyTeam,
      join,
      hasHuman: (accountId, heroId) => this.hasHuman(accountId, heroId),
      effectIds: battleOpener(this.humans).effects.effectIds,
    });
  }

  authenticate(accountId: number, nowMs: number): readonly BattleEvent[] {
    return authenticateFighter({
      ...this.actionState(),
      hasEnemyBots: this.fightRules.hasEnemyBots,
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

  tryPocket(
    accountId: number,
    itemId: number,
    nowMs: number,
    sequence: string | number,
  ): KeepTurnResult {
    const human = requireAuthedHuman(this.humans, accountId);
    return tryPocketCast(human, itemId, nowMs, sequence, rosterIsPvp(this.humans));
  }

  tryRage(accountId: number): KeepTurnResult {
    return tryRageCast(requireAuthedHuman(this.humans, accountId));
  }

  tryAggro(accountId: number, targetId: number, allocateBotId: () => number): HuntAggroResult {
    return tryHuntAggro({
      ...this.actionState(),
      canAggro: this.fightRules.canAggro,
      enemyTeam: this.fightRules.teamAssignment.enemyTeam,
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

  resolveBotMelee(accountId: number, nowMs: number): BotMeleeResult {
    const result = applyBattleBotMelee(this.actionState(), accountId, this.livingHumans(), nowMs);
    if (result.finished) this.finishedValue = true;
    return result;
  }

  tickRosterDuels(nowMs: number): readonly BattleEvent[] {
    const ticked = tickHuntRosterDuels({
      hasEnemyBots: this.fightRules.hasEnemyBots,
      bots: this.bots,
      enemyTeam: this.fightRules.teamAssignment.enemyTeam,
      duels: this.duels,
      finished: this.finishedValue,
      opener: battleOpener(this.humans),
      humans: this.humans,
      fightId: this.id,
      rules: this.rules,
      random: this.random,
      nowMs,
    });
    if (ticked.finished) this.finishedValue = true;
    return ticked.events;
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
    if (!this.fightRules.shufflesAfterHits) return { kind: "none" };
    const human = requireBattleHuman(this.humans, accountId);
    const duel = this.duels.find((entry) => entry.has(human.heroId));
    if (!duel) return { kind: "none" };
    return shuffleHuntAfterHits({
      pairing: huntPairingOf(duel, this.humans, accountId),
      openerTeam: this.fightRules.teamAssignment.openerTeam,
      enemyTeam: this.fightRules.teamAssignment.enemyTeam,
      bots: this.bots,
      duels: this.duels,
      finished: this.finishedValue,
    });
  }

  timeoutTurn(accountId: number, nowMs: number): HumanTimeout | null {
    const result = timeoutBattleTurn({ ...this.actionState(), accountId, nowMs });
    if (result?.finished) this.finishedValue = true;
    return result ? result.timeout : null;
  }

  consumeStunSkip(accountId: number): boolean {
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
    humans: readonly HuntHuman[];
    bots: readonly HuntBotSnap[];
  }> {
    return { humans: this.humans, bots: this.bots.map((bot) => bot.snap()) };
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
    const primary = primaryEnemyBot(this.bots, this.fightRules.teamAssignment.enemyTeam);
    return pairNextHuntWaiter({
      pairing: huntPairingOf(duel, this.humans, previousAccountId),
      primary,
      openerTeam: this.fightRules.teamAssignment.openerTeam,
      enemyTeam: this.fightRules.teamAssignment.enemyTeam,
      botHp: primary.hp,
      finished: this.finishedValue,
    });
  }

  dissolveDuelOf(accountId: number): void {
    const human = requireBattleHuman(this.humans, accountId);
    dissolveDuelContaining(this.duels, this.humans, human.heroId, this.bots);
  }

  private actionState() {
    return {
      fightRules: this.fightRules,
      finished: this.finishedValue,
      humans: this.humans,
      duels: this.duels,
      bots: this.bots,
      rules: this.rules,
      random: this.random,
      fightId: this.id,
    };
  }
}
