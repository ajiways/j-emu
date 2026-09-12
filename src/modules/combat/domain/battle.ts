import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import { friendlyAuthenticateEvents, huntAuthenticateEvents } from "./battle-authenticate.ts";
import { friendlyHuman, huntOpener, isHumanDuelInit } from "./battle-fighters.ts";
import { addHuntHuman, huntHistoryOf } from "./battle-hunt-join.ts";
import {
  battleOpener,
  huntPairingOf,
  huntRosterBots,
  requireAuthedHuman,
  requireBattleHuman,
  requireBattleHuntRoster,
  requireHuntInit,
  resolveBattleMeleeTarget,
} from "./battle-lookups.ts";
import { FightDuel } from "./fight-duel.ts";
import type { FriendlyDuelBattleInit } from "./friendly-duel-battle-init.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import { HuntRoster } from "./hunt-roster.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { grantTurn as grantHumanTurn, type BotMeleeResult } from "./hunt-melee.ts";
import type { PlayerMeleeResult } from "./paired-melee.ts";
import {
  tryAggroCast,
  tryGloveKeepTurn,
  tryPocketCast,
  tryRageCast,
  type EndingGloveResult,
  type KeepTurnResult,
} from "./hunt-cast.ts";
import { applyPairedGloveEnding, applyPairedMelee, applyBotTurn } from "./battle-strikes.ts";
import { applyHuntBotHit, applyHuntPlayerHit, tickHuntRosterDuels } from "./battle-hunt-runtime.ts";
import type { HuntJoinHuman } from "./hunt-join-human.ts";
import type { RandomSource } from "./random-source.ts";
import { requireFriendlyDuelBattleInit } from "./require-friendly-duel-battle-init.ts";
import { requireHuntBattleInit } from "./require-hunt-battle-init.ts";
import { pairNextHuntWaiter, shuffleHuntAfterHits } from "./battle-pairing.ts";
import { battleOutcomeSnapshot } from "./battle-outcome.ts";
import type { FightOutcomeKind, FightOutcomeSnapshot } from "./fight-outcome-snapshot.ts";
import type { ShuffleOutcome } from "./try-shuffle-after-hits.ts";

export class Battle {
  readonly kind: "hunt" | "friendly-duel" | "pvp";
  readonly id: string;
  readonly accessKey: string;
  readonly arena: string;
  readonly areaId: string;
  readonly startedAt: Date;
  readonly turnTimeoutSeconds: number;
  readonly meleeBotCounterMs: number;
  readonly turnGrantDelayMs: number;
  private finishedValue = false;
  private pairedAccountIdValue: number;
  private readonly humans: HuntHuman[] = [];
  private readonly duel: FightDuel;
  private readonly huntRoster: HuntRoster | null;

  constructor(
    readonly init: HuntBattleInit | FriendlyDuelBattleInit,
    private readonly rules: BattleRules,
    private readonly random: RandomSource,
  ) {
    this.id = init.fightId;
    this.accessKey = init.accessKey;
    this.arena = init.arena;
    this.areaId = init.areaId;
    this.startedAt = init.startedAt;
    this.turnTimeoutSeconds = rules.turnTimeoutSeconds;
    this.meleeBotCounterMs = rules.meleeBotCounterMs;
    this.turnGrantDelayMs = rules.turnGrantDelayMs;
    if (isHumanDuelInit(init)) {
      requireFriendlyDuelBattleInit(init, rules);
      this.kind = init.kind;
      this.huntRoster = null;
      this.pairedAccountIdValue = init.challenger.accountId;
      this.humans.push(
        friendlyHuman(init.challenger, 1, false, init.startedAt.getTime()),
        friendlyHuman(init.acceptor, 2, false, init.startedAt.getTime()),
      );
      this.duel = new FightDuel(
        init.challenger.heroId,
        init.acceptor.heroId,
        init.challenger.heroId,
      );
      return;
    }
    requireHuntBattleInit(init, rules);
    this.kind = "hunt";
    this.huntRoster = new HuntRoster(init);
    this.pairedAccountIdValue = init.accountId;
    this.humans.push(huntOpener(init));
    this.duel = new FightDuel(init.heroId, init.botFightId, init.heroId);
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
    return this.kind === "hunt" ? requireHuntInit(this.init).purpose : this.kind;
  }

  openerTeam(): 1 | 2 {
    return battleOpener(this.humans).team;
  }

  questChat(): Readonly<{ chatWin: string; chatLose: string }> {
    const hunt = requireHuntInit(this.init);
    return { chatWin: hunt.chatWin, chatLose: hunt.chatLose };
  }

  skipQuestKills(): boolean {
    return this.huntRoster?.skipQuestKills() === true;
  }

  huntHistory() {
    return huntHistoryOf(battleOpener(this.humans), requireHuntInit(this.init));
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

  hasWaitingHuman(): boolean {
    return this.humans.some((human) => human.waiting && !human.leftLive && human.hp > 0);
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
    const target = resolveBattleMeleeTarget(
      requireBattleHuman(this.humans, accountId),
      this.duel,
      this.humans,
      huntRosterBots(this.huntRoster),
    );
    if (target.kind === "bot") return { kind: "bot" };
    return { kind: "human", accountId: target.human.accountId };
  }

  addHuman(join: HuntJoinHuman): BattleEvent {
    return addHuntHuman({
      kind: this.kind,
      finished: this.finishedValue,
      humans: this.humans,
      roster: requireBattleHuntRoster(this.huntRoster),
      hunt: requireHuntInit(this.init),
      join,
      hasHuman: (accountId, heroId) => this.hasHuman(accountId, heroId),
    });
  }

  authenticate(accountId: number, nowMs: number): readonly BattleEvent[] {
    if (this.finishedValue) throw new Error("Cannot authenticate a finished battle");
    const human = requireBattleHuman(this.humans, accountId);
    if (human.authed) throw new Error("Fight session is already authenticated");
    const resume = human.takeResume();
    human.authed = true;
    if (isHumanDuelInit(this.init)) {
      return friendlyAuthenticateEvents({
        human,
        opponent: requireBattleHuman(this.humans, this.opponentAccountId(accountId)),
        nextActorId: this.duel.nextActorId,
        timeoutSeconds: this.rules.turnTimeoutSeconds,
        nowMs,
      });
    }
    return huntAuthenticateEvents({
      human,
      allies: this.humans,
      init: requireHuntInit(this.init),
      botHp: requireBattleHuntRoster(this.huntRoster).primary.hp,
      rosterBots: requireBattleHuntRoster(this.huntRoster).snaps(),
      resume,
      timeoutSeconds: this.rules.turnTimeoutSeconds,
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

  // prettier-ignore
  tryPlayerMelee(accountId: number, side: "left" | "center" | "right", nowMs: number): PlayerMeleeResult {
    const human = requireAuthedHuman(this.humans, accountId);
    const resolved = applyPairedMelee({
      attacker: human,
      side,
      finished: this.finishedValue,
      rules: this.rules,
      random: this.random,
      fightId: this.id,
      humans: this.humans,
      bots: huntRosterBots(this.huntRoster),
      duel: this.duel,
      nowMs,
    });
    const applied = applyHuntPlayerHit(resolved, {
      roster: this.huntRoster,
      duel: this.duel,
      opener: battleOpener(this.humans),
    });
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

  tryAggro(accountId: number): KeepTurnResult {
    return tryAggroCast(requireAuthedHuman(this.humans, accountId));
  }

  // prettier-ignore
  tryGlove(accountId: number, spellId: number, sequence: string | number, nowMs: number): KeepTurnResult | EndingGloveResult {
    const human = requireAuthedHuman(this.humans, accountId);
    const keep = tryGloveKeepTurn(human, spellId, sequence);
    if (keep.kind !== "ignored") return keep;
    const ending = applyPairedGloveEnding({
      human,
      spellId,
      sequence,
      finished: this.finishedValue,
      rules: this.rules,
      random: this.random,
      fightId: this.id,
      humans: this.humans,
      bots: huntRosterBots(this.huntRoster),
      duel: this.duel,
      nowMs,
    });
    if (ending.kind === "ending") {
      const extra = applyHuntBotHit(ending.hitBot, ending.finished, {
        roster: this.huntRoster,
        duel: this.duel,
        opener: battleOpener(this.humans),
      });
      if (extra.finished) this.finishedValue = true;
      if (extra.events.length === 0) return ending;
      return { ...ending, events: [...ending.events, ...extra.events] };
    }
    return ending;
  }

  resolveBotMelee(): BotMeleeResult {
    if (this.kind !== "hunt") throw new Error("Human duel has no bot to take a turn");
    const roster = requireBattleHuntRoster(this.huntRoster);
    if (this.finishedValue) throw new Error("Cannot resolve bot melee on a finished battle");
    const hunt = requireHuntInit(this.init);
    const target = requireBattleHuman(this.humans, this.pairedAccountIdValue);
    const bot = roster.bot(this.duel.otherId(target.heroId));
    const result = applyBotTurn({
      target,
      rules: this.rules,
      random: this.random,
      hunt: {
        ...hunt,
        botFightId: bot.fightId,
        botStrength: bot.strength,
        botMaxHp: bot.maxHp,
        botSpellBook: bot.spellBook,
      },
      botHp: bot.hp,
      fightId: this.id,
      hasWaiter: this.hasWaitingHuman(),
      casts: bot.casts,
      living: this.livingHumans(),
      duel: this.duel,
    });
    bot.setHp(result.botHp);
    if (result.events.some((event) => event.type === "finished")) this.finishedValue = true;
    return result;
  }

  tickRosterDuels(): readonly BattleEvent[] {
    const ticked = tickHuntRosterDuels({
      roster: this.huntRoster,
      finished: this.finishedValue,
      opener: battleOpener(this.humans),
      fightId: this.id,
      rules: this.rules,
      random: this.random,
    });
    if (ticked.finished) this.finishedValue = true;
    return ticked.events;
  }

  tryShuffleAfterHits(): ShuffleOutcome {
    if (this.kind !== "hunt") return { kind: "none" };
    const hunt = requireHuntInit(this.init);
    if (hunt.purpose === "quest") return { kind: "none" };
    const pairing = huntPairingOf(this.duel, this.humans, this.pairedAccountIdValue);
    const result = shuffleHuntAfterHits({
      pairing,
      hunt,
      botHp: requireBattleHuntRoster(this.huntRoster).primary.hp,
      finished: this.finishedValue,
    });
    this.pairedAccountIdValue = pairing.pairedAccountId;
    return result;
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
      init: this.init,
      fightId: this.id,
      kind,
      winnerTeam,
      humans: this.humans,
    });
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
    const remaining = this.humans.filter((human) => !human.leftLive);
    const last = remaining[remaining.length - 1];
    if (!last) throw new Error("Leave requires a human in the battle");
    return last.hp <= 0 ? 2 : 1;
  }

  pairNextWaiter(): Readonly<{
    accountId: number;
    authed: boolean;
    events: readonly BattleEvent[];
  }> | null {
    if (this.kind !== "hunt") return null;
    const pairing = huntPairingOf(this.duel, this.humans, this.pairedAccountIdValue);
    const result = pairNextHuntWaiter({
      pairing,
      hunt: requireHuntInit(this.init),
      botHp: requireBattleHuntRoster(this.huntRoster).primary.hp,
      finished: this.finishedValue,
    });
    this.pairedAccountIdValue = pairing.pairedAccountId;
    return result;
  }
}
