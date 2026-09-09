import type { BattleEvent, HuntBotSnap } from "./battle-event.ts";
import type { HuntBattleInit } from "./hunt-battle-init.ts";
import { HuntHuman, type HuntHumanSnap } from "./hunt-human.ts";
import { requireHuntBattleInit } from "./require-hunt-battle-init.ts";
import type { RandomSource } from "./random-source.ts";

export type BattleRules = Readonly<{
  playerDamageMin: number;
  playerDamageMax: number;
  botDamageMin: number;
  botDamageMax: number;
  turnTimeoutSeconds: number;
}>;

type HuntJoinHuman = Readonly<{
  accountId: number;
  heroId: number;
  nick: string;
  level: number;
  kind: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
}>;

export class Battle {
  private playerHpValue: number;
  private botHpValue: number;
  private finishedValue = false;
  private readonly humans: HuntHuman[] = [];

  constructor(
    readonly init: HuntBattleInit,
    private readonly rules: BattleRules,
    private readonly random: RandomSource,
  ) {
    this.playerHpValue = init.playerHp;
    this.botHpValue = init.botMaxHp;
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
    });
    this.humans.push(human);
    const joined = this.humanSnap(human);
    return {
      type: "roster-updated",
      humans: this.humans.map((entry) => this.humanSnap(entry)),
      bot: this.botSnap(),
      joined,
    };
  }

  authenticate(accountId: number): readonly BattleEvent[] {
    if (this.finishedValue) throw new Error("Cannot authenticate a finished battle");
    const human = this.requireHuman(accountId);
    if (human.authed) throw new Error("Fight session is already authenticated");
    human.authed = true;
    const events: BattleEvent[] = [this.bootstrapEvent(human)];
    if (!human.waiting) {
      events.push({ type: "turn-granted", timeoutSeconds: this.rules.turnTimeoutSeconds });
    }
    return events;
  }

  strike(accountId: number, side: "left" | "center" | "right"): readonly BattleEvent[] {
    const human = this.requireHuman(accountId);
    if (!human.authed) throw new Error("Fight session is not authenticated");
    if (human.waiting) throw new Error("Queued hunter cannot strike");
    if (this.finishedValue) throw new Error("Fight is already finished");

    const playerDamage = this.random.integer(
      this.rules.playerDamageMin,
      this.rules.playerDamageMax,
    );
    this.botHpValue = Math.max(0, this.botHpValue - playerDamage);
    const playerCast: BattleEvent = {
      type: "damage",
      sourceId: this.heroId,
      targetId: this.botFightId,
      animation: `attack_${side}`,
      hpChange: -playerDamage,
      targetMaxHp: this.init.botMaxHp,
      killed: this.botHpValue === 0,
    };
    if (this.botHpValue === 0) {
      this.finishedValue = true;
      return [playerCast, { type: "finished", winnerTeam: 1, fightId: this.id }];
    }

    const botDamage = this.random.integer(this.rules.botDamageMin, this.rules.botDamageMax);
    this.playerHpValue = Math.max(0, this.playerHpValue - botDamage);
    const botCast: BattleEvent = {
      type: "damage",
      sourceId: this.botFightId,
      targetId: this.heroId,
      animation: "attack_center",
      hpChange: -botDamage,
      targetMaxHp: this.init.playerMaxHp,
      killed: this.playerHpValue === 0,
    };
    if (this.playerHpValue === 0) {
      this.finishedValue = true;
      return [playerCast, botCast, { type: "finished", winnerTeam: 2, fightId: this.id }];
    }
    return [
      playerCast,
      botCast,
      { type: "turn-granted", timeoutSeconds: this.rules.turnTimeoutSeconds },
    ];
  }

  private requireHuman(accountId: number): HuntHuman {
    const human = this.humans.find((entry) => entry.accountId === accountId);
    if (!human) throw new Error(`Human account ${accountId} is not in this battle`);
    return human;
  }

  private bootstrapEvent(viewer: HuntHuman): BattleEvent {
    return {
      type: "hunt-bootstrap",
      waiting: viewer.waiting,
      hero: this.humanSnap(viewer),
      allies: this.humans
        .filter((entry) => entry.accountId !== viewer.accountId)
        .map((entry) => this.humanSnap(entry)),
      bot: this.botSnap(),
    };
  }

  private humanSnap(human: HuntHuman): HuntHumanSnap {
    const hp = human.accountId === this.accountId ? this.playerHpValue : human.hp;
    return human.snapshot(hp);
  }

  private botSnap(): HuntBotSnap {
    return {
      id: this.botFightId,
      nick: this.botNick,
      level: this.botLevel,
      hp: this.botHpValue,
      maxHp: this.init.botMaxHp,
      artikulId: this.botArtikulId,
      avatar: this.init.botAvatar,
      sk: this.init.botSk,
      body: this.init.botBody,
      team: 2,
    };
  }
}
