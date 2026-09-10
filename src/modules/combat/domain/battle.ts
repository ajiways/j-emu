import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import { friendlyAuthenticateEvents, huntAuthenticateEvents } from "./battle-authenticate.ts";
import { friendlyHuman, huntJoiner, huntOpener, isFriendlyDuelInit } from "./battle-fighters.ts";
import { FightDuel } from "./fight-duel.ts";
import type { FriendlyDuelBattleInit } from "./friendly-duel-battle-init.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import { huntBotSnap } from "./hunt-bot-snap.ts";
import type { HuntHuman } from "./hunt-human.ts";
import {
  grantTurn as grantHumanTurn,
  type BotMeleeResult,
  type PlayerMeleeResult,
} from "./hunt-melee.ts";
import {
  tryAggroCast,
  tryGloveKeepTurn,
  tryPocketCast,
  tryRageCast,
  type EndingGloveResult,
  type KeepTurnResult,
} from "./hunt-cast.ts";
import {
  applyBotTurn,
  applyHuntGloveEnding,
  applyHuntMelee,
  applyPvpMelee,
} from "./battle-strikes.ts";
import type { HuntJoinHuman } from "./hunt-join-human.ts";
import type { RandomSource } from "./random-source.ts";
import { requireFriendlyDuelBattleInit } from "./require-friendly-duel-battle-init.ts";
import { requireHuntBattleInit } from "./require-hunt-battle-init.ts";
import { pairNextHuntWaiter, shuffleHuntAfterHits, type HuntPairing } from "./battle-pairing.ts";
import { battleOutcomeSnapshot } from "./battle-outcome.ts";
import type { FightOutcomeKind, FightOutcomeSnapshot } from "./fight-outcome-snapshot.ts";
import type { ShuffleOutcome } from "./try-shuffle-after-hits.ts";

export class Battle {
  readonly kind: "hunt" | "friendly-duel";
  readonly id: string;
  readonly accessKey: string;
  readonly arena: string;
  readonly areaId: string;
  readonly startedAt: Date;
  readonly turnTimeoutSeconds: number;
  readonly meleeBotCounterMs: number;
  readonly turnGrantDelayMs: number;
  private botHpValue: number | null;
  private finishedValue = false;
  private pairedAccountIdValue: number;
  private readonly humans: HuntHuman[] = [];
  private readonly botCasts = new Map<number, number>();
  private readonly duel: FightDuel;

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
    if (isFriendlyDuelInit(init)) {
      requireFriendlyDuelBattleInit(init, rules);
      this.kind = "friendly-duel";
      this.botHpValue = null;
      this.pairedAccountIdValue = init.challenger.accountId;
      this.humans.push(
        friendlyHuman(init.challenger, 1, false),
        friendlyHuman(init.acceptor, 2, false),
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
    this.botHpValue = init.botMaxHp;
    this.pairedAccountIdValue = init.accountId;
    this.humans.push(huntOpener(init));
    this.duel = new FightDuel(init.heroId, init.botFightId, init.heroId);
  }

  get accountId(): number {
    return this.opener().accountId;
  }
  get pairedAccountId(): number {
    return this.pairedAccountIdValue;
  }
  get finished(): boolean {
    return this.finishedValue;
  }

  huntHistory() {
    const opener = this.opener();
    const hunt = this.huntInit();
    return {
      accountId: opener.accountId,
      heroId: opener.heroId,
      heroNick: opener.nick,
      heroLevel: opener.level,
      heroKind: opener.kind,
      botArtikulId: hunt.botArtikulId,
      botNick: hunt.botNick,
      botLevel: hunt.botLevel,
    };
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
    const otherHeroId = this.duel.otherId(this.requireHuman(accountId).heroId);
    const other = this.humans.find((entry) => entry.heroId === otherHeroId);
    if (!other) throw new Error(`Duel opponent ${otherHeroId} is not a human in this battle`);
    return other.accountId;
  }

  addHuman(join: HuntJoinHuman): BattleEvent {
    if (this.kind !== "hunt") throw new Error("Cannot join a friendly duel");
    if (this.finishedValue) throw new Error("Cannot join a finished battle");
    if (this.hasHuman(join.accountId, join.heroId)) {
      throw new Error("Human is already in this battle");
    }
    if (join.heroId === this.huntInit().botFightId) {
      throw new Error("Fight bot id collides with the human participant id");
    }
    const human = huntJoiner(join);
    this.humans.push(human);
    return {
      type: "roster-updated",
      humans: this.humans.map((entry) => entry.snapshot()),
      bot: huntBotSnap(this.huntInit(), this.requireBotHp()),
      joined: human.snapshot(),
    };
  }

  authenticate(accountId: number, nowMs: number): readonly BattleEvent[] {
    if (this.finishedValue) throw new Error("Cannot authenticate a finished battle");
    const human = this.requireHuman(accountId);
    if (human.authed) throw new Error("Fight session is already authenticated");
    const resume = human.takeResume();
    human.authed = true;
    if (this.kind === "friendly-duel") {
      return friendlyAuthenticateEvents({
        human,
        opponent: this.requireHuman(this.opponentAccountId(accountId)),
        nextActorId: this.duel.nextActorId,
        timeoutSeconds: this.rules.turnTimeoutSeconds,
        nowMs,
      });
    }
    return huntAuthenticateEvents({
      human,
      allies: this.humans,
      init: this.huntInit(),
      botHp: this.requireBotHp(),
      resume,
      timeoutSeconds: this.rules.turnTimeoutSeconds,
      nowMs,
    });
  }

  prepareResume(accountId: number): void {
    if (this.finishedValue) throw new Error("Cannot resume a finished battle");
    const human = this.requireHuman(accountId);
    const wasAuthed = human.authed;
    human.authed = false;
    if (wasAuthed) human.markResume();
  }

  heroIdFor(accountId: number): number {
    return this.requireHuman(accountId).heroId;
  }

  tryPlayerMelee(accountId: number, side: "left" | "center" | "right"): PlayerMeleeResult {
    const human = this.requireAuthed(accountId);
    if (this.kind === "friendly-duel") {
      const resolved = applyPvpMelee({
        attacker: human,
        defender: this.requireHuman(this.opponentAccountId(accountId)),
        side,
        finished: this.finishedValue,
        rules: this.rules,
        random: this.random,
        fightId: this.id,
        duel: this.duel,
      });
      if (resolved.finished) this.finishedValue = true;
      return resolved.result;
    }
    const resolved = applyHuntMelee({
      human,
      side,
      finished: this.finishedValue,
      rules: this.rules,
      random: this.random,
      botHp: this.requireBotHp(),
      hunt: this.huntInit(),
      fightId: this.id,
      duel: this.duel,
    });
    this.botHpValue = resolved.botHp;
    if (resolved.finished) this.finishedValue = true;
    return resolved.result;
  }

  tryPocket(
    accountId: number,
    itemId: number,
    nowMs: number,
    sequence: string | number,
  ): KeepTurnResult {
    return tryPocketCast(this.requireAuthed(accountId), itemId, nowMs, sequence);
  }

  tryRage(accountId: number): KeepTurnResult {
    return tryRageCast(this.requireAuthed(accountId));
  }

  tryAggro(accountId: number): KeepTurnResult {
    return tryAggroCast(this.requireAuthed(accountId));
  }

  tryGlove(
    accountId: number,
    spellId: number,
    sequence: string | number,
  ): KeepTurnResult | EndingGloveResult {
    const human = this.requireAuthed(accountId);
    const keep = tryGloveKeepTurn(human, spellId, sequence);
    if (keep.kind !== "ignored") return keep;
    if (this.kind === "friendly-duel") {
      throw new Error("Friendly duel glove finishers are not in this slice");
    }
    const ending = applyHuntGloveEnding({
      human,
      spellId,
      sequence,
      finished: this.finishedValue,
      rules: this.rules,
      random: this.random,
      botHp: this.requireBotHp(),
      hunt: this.huntInit(),
      fightId: this.id,
      duel: this.duel,
    });
    if (ending.kind === "ending") {
      this.botHpValue = ending.botHp;
      if (ending.finished) this.finishedValue = true;
    }
    return ending;
  }

  resolveBotMelee(): BotMeleeResult {
    if (this.kind !== "hunt") throw new Error("Friendly duel has no bot turn");
    if (this.finishedValue) throw new Error("Cannot resolve bot melee on a finished battle");
    const hunt = this.huntInit();
    const result = applyBotTurn({
      target: this.requireHuman(this.pairedAccountIdValue),
      rules: this.rules,
      random: this.random,
      hunt,
      botHp: this.requireBotHp(),
      fightId: this.id,
      hasWaiter: this.hasWaitingHuman(),
      casts: this.botCasts,
      living: this.livingHumans(),
      duel: this.duel,
    });
    this.botHpValue = result.botHp;
    if (result.events.some((event) => event.type === "finished")) this.finishedValue = true;
    return result;
  }

  tryShuffleAfterHits(): ShuffleOutcome {
    if (this.kind !== "hunt") return { kind: "none" };
    const pairing = this.pairing();
    const result = shuffleHuntAfterHits({
      pairing,
      hunt: this.huntInit(),
      botHp: this.requireBotHp(),
      finished: this.finishedValue,
    });
    this.pairedAccountIdValue = pairing.pairedAccountId;
    return result;
  }

  grantTurn(accountId: number, nowMs: number): BattleEvent | null {
    if (this.finishedValue) return null;
    return grantHumanTurn(this.requireHuman(accountId), this.rules.turnTimeoutSeconds, nowMs);
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
    const human = this.requireHuman(accountId);
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
    const pairing = this.pairing();
    const result = pairNextHuntWaiter({
      pairing,
      hunt: this.huntInit(),
      botHp: this.requireBotHp(),
      finished: this.finishedValue,
    });
    this.pairedAccountIdValue = pairing.pairedAccountId;
    return result;
  }

  private pairing(): HuntPairing {
    return { duel: this.duel, humans: this.humans, pairedAccountId: this.pairedAccountIdValue };
  }

  private opener(): HuntHuman {
    const human = this.humans[0];
    if (!human) throw new Error("Battle has no humans");
    return human;
  }

  private huntInit(): HuntBattleInit {
    if (isFriendlyDuelInit(this.init)) throw new Error("Friendly duel has no hunt bot");
    return this.init;
  }

  private requireBotHp(): number {
    if (this.botHpValue === null) throw new Error("Friendly duel has no bot HP");
    return this.botHpValue;
  }

  private requireAuthed(accountId: number): HuntHuman {
    const human = this.requireHuman(accountId);
    if (!human.authed) throw new Error("Fight session is not authenticated");
    return human;
  }

  private requireHuman(accountId: number): HuntHuman {
    const human = this.humans.find((entry) => entry.accountId === accountId);
    if (!human) throw new Error(`Human account ${accountId} is not in this battle`);
    return human;
  }
}
