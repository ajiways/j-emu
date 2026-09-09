import type { BattleEvent } from "./battle-event.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import { huntBotSnap } from "./hunt-bot-snap.ts";
import { HuntHuman } from "./hunt-human.ts";
import {
  grantTurn as grantHumanTurn,
  resolveBotMelee as resolvePairedBotMelee,
  tryPlayerMelee as resolvePlayerMelee,
  type BotMeleeResult,
  type PlayerMeleeResult,
} from "./hunt-melee.ts";
import {
  resolveGloveFinisher,
  tryAggroCast,
  tryGloveKeepTurn,
  tryPocketCast,
  tryRageCast,
  type EndingGloveResult,
  type KeepTurnResult,
} from "./hunt-cast.ts";
import type { HuntJoinHuman } from "./hunt-join-human.ts";
import type { RandomSource } from "./random-source.ts";
import { requireHuntBattleInit } from "./require-hunt-battle-init.ts";
import type { FightOutcomeKind, FightOutcomeSnapshot } from "./fight-outcome-snapshot.ts";

export class Battle {
  private botHpValue: number;
  private finishedValue = false;
  private pairedAccountIdValue: number;
  private readonly humans: HuntHuman[] = [];

  constructor(
    readonly init: HuntBattleInit,
    private readonly rules: BattleRules,
    private readonly random: RandomSource,
  ) {
    this.botHpValue = init.botMaxHp;
    this.pairedAccountIdValue = init.accountId;
    requireHuntBattleInit(init, rules);
    this.humans.push(
      new HuntHuman({
        accountId: init.accountId,
        heroId: init.heroId,
        nick: init.heroNick,
        level: init.heroLevel,
        kind: init.heroKind,
        hp: init.playerHp,
        maxHp: init.playerMaxHp,
        mp: init.heroMp,
        maxMp: init.heroMaxMp,
        team: 1,
        waiting: false,
        loadout: init.loadout,
      }),
    );
  }

  get id(): string {
    return this.init.fightId;
  }
  get accessKey(): string {
    return this.init.accessKey;
  }
  get accountId(): number {
    return this.init.accountId;
  }
  get heroId(): number {
    return this.init.heroId;
  }
  get heroNick(): string {
    return this.init.heroNick;
  }
  get heroLevel(): number {
    return this.init.heroLevel;
  }
  get heroKind(): number {
    return this.init.heroKind;
  }
  get botArtikulId(): number {
    return this.init.botArtikulId;
  }
  get botFightId(): number {
    return this.init.botFightId;
  }
  get botNick(): string {
    return this.init.botNick;
  }
  get botLevel(): number {
    return this.init.botLevel;
  }
  get arena(): string {
    return this.init.arena;
  }
  get areaId(): string {
    return this.init.areaId;
  }
  get startedAt(): Date {
    return this.init.startedAt;
  }
  get turnTimeoutSeconds(): number {
    return this.rules.turnTimeoutSeconds;
  }
  get meleeBotCounterMs(): number {
    return this.rules.meleeBotCounterMs;
  }
  get turnGrantDelayMs(): number {
    return this.rules.turnGrantDelayMs;
  }
  get pairedAccountId(): number {
    return this.pairedAccountIdValue;
  }
  get finished(): boolean {
    return this.finishedValue;
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

  addHuman(join: HuntJoinHuman): BattleEvent {
    if (this.finishedValue) throw new Error("Cannot join a finished battle");
    if (this.hasHuman(join.accountId, join.heroId)) {
      throw new Error("Human is already in this battle");
    }
    if (join.heroId === this.botFightId) {
      throw new Error("Fight bot id collides with the human participant id");
    }
    const human = new HuntHuman({
      accountId: join.accountId,
      heroId: join.heroId,
      nick: join.nick,
      level: join.level,
      kind: join.kind,
      hp: join.hp,
      maxHp: join.maxHp,
      mp: join.mp,
      maxMp: join.maxMp,
      team: 1,
      waiting: true,
      loadout: join.loadout,
    });
    this.humans.push(human);
    return {
      type: "roster-updated",
      humans: this.humans.map((entry) => entry.snapshot()),
      bot: huntBotSnap(this.init, this.botHpValue),
      joined: human.snapshot(),
    };
  }

  authenticate(accountId: number, nowMs: number): readonly BattleEvent[] {
    if (this.finishedValue) throw new Error("Cannot authenticate a finished battle");
    const human = this.requireHuman(accountId);
    if (human.authed) throw new Error("Fight session is already authenticated");
    const resume = human.takeResume();
    human.authed = true;
    if (!human.waiting && !resume) human.beginTurn(nowMs, this.rules.turnTimeoutSeconds);
    const events: BattleEvent[] = [
      {
        type: "hunt-bootstrap",
        waiting: human.waiting,
        ...(resume && !human.waiting ? { resumePaired: true as const } : {}),
        hero: human.snapshot(),
        allies: this.humans
          .filter((entry) => entry.accountId !== human.accountId)
          .map((entry) => entry.snapshot()),
        bot: huntBotSnap(this.init, this.botHpValue),
        cp: human.casts.cp,
        cpHits: human.casts.hits,
        rage: human.casts.rage,
        aggro: human.casts.aggro,
        loadout: human.casts.loadout,
      },
    ];
    if (!human.waiting && human.turnActive) {
      const restTime = resume ? human.remainingTurnSeconds(nowMs) : this.rules.turnTimeoutSeconds;
      if (restTime === null) throw new Error("Paired hunter is missing a turn deadline");
      events.push({ type: "turn-granted", timeoutSeconds: restTime });
    }
    return events;
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
    const human = this.requireHuman(accountId);
    if (!human.authed) throw new Error("Fight session is not authenticated");
    const resolved = resolvePlayerMelee(human, side, {
      finished: this.finishedValue,
      rules: this.rules,
      random: this.random,
      botHp: this.botHpValue,
      botFightId: this.botFightId,
      botMaxHp: this.init.botMaxHp,
      fightId: this.id,
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
    const ending = resolveGloveFinisher(human, spellId, sequence, {
      finished: this.finishedValue,
      rules: this.rules,
      random: this.random,
      botHp: this.botHpValue,
      botFightId: this.botFightId,
      botMaxHp: this.init.botMaxHp,
      fightId: this.id,
    });
    if (ending.kind === "ending") {
      this.botHpValue = ending.botHp;
      if (ending.finished) this.finishedValue = true;
    }
    return ending;
  }

  resolveBotMelee(): BotMeleeResult {
    if (this.finishedValue) throw new Error("Cannot resolve bot melee on a finished battle");
    const result = resolvePairedBotMelee(this.requireHuman(this.pairedAccountIdValue), {
      rules: this.rules,
      random: this.random,
      botFightId: this.botFightId,
      fightId: this.id,
      hasWaiter: this.hasWaitingHuman(),
    });
    if (result.events.some((event) => event.type === "finished")) this.finishedValue = true;
    return result;
  }

  grantTurn(accountId: number, nowMs: number): BattleEvent | null {
    if (this.finishedValue) return null;
    return grantHumanTurn(this.requireHuman(accountId), this.rules.turnTimeoutSeconds, nowMs);
  }

  outcome(kind: FightOutcomeKind, winnerTeam: 1 | 2): FightOutcomeSnapshot {
    return {
      fightId: this.id,
      botId: this.init.botArtikulId,
      botLevel: this.init.botLevel,
      winnerTeam,
      kind,
      humans: this.humans.map((human) => ({
        accountId: human.accountId,
        characterId: human.heroId,
        level: human.level,
        hp: human.hp,
        damageToBot: human.damageToBot,
        leftLive: human.leftLive,
        pocket: human.pocketCells(),
      })),
    };
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
    if (this.finishedValue || this.botHpValue === 0) return null;
    const waiter = this.humans.find((entry) => entry.waiting && !entry.leftLive && entry.hp > 0);
    if (!waiter) return null;
    waiter.pair();
    this.pairedAccountIdValue = waiter.accountId;
    if (!waiter.authed) return { accountId: waiter.accountId, authed: false, events: [] };
    return {
      accountId: waiter.accountId,
      authed: true,
      events: [{ type: "opponent-new", bot: huntBotSnap(this.init, this.botHpValue) }],
    };
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
