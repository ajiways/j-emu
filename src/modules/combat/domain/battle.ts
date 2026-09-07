import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { RandomSource } from "./random-source.ts";

export type BattleRules = Readonly<{
  playerDamageMin: number;
  playerDamageMax: number;
  botDamageMin: number;
  botDamageMax: number;
  turnTimeoutSeconds: number;
}>;

export type BattleEvent =
  | Readonly<{
      type: "opponent-introduced";
      id: number;
      nick: string;
      hp: number;
      maxHp: number;
      level: number;
      team: 2;
    }>
  | Readonly<{
      type: "damage";
      sourceId: number;
      targetId: number;
      animation: string;
      hpChange: number;
      killed: boolean;
    }>
  | Readonly<{ type: "turn-granted"; timeoutSeconds: number }>
  | Readonly<{ type: "finished"; winnerTeam: 1 | 2; fightId: string }>;

export type HuntBattleInit = Readonly<{
  fightId: string;
  accessKey: string;
  accountId: number;
  heroId: number;
  heroNick: string;
  heroLevel: number;
  heroKind: number;
  botArtikulId: number;
  botFightId: number;
  botNick: string;
  botLevel: number;
  playerMaxHp: number;
  botMaxHp: number;
  arena: string;
  areaId: string;
  startedAt: Date;
}>;

export class Battle {
  private playerHpValue: number;
  private botHpValue: number;
  private authenticated = false;
  private finishedValue = false;

  constructor(
    readonly init: HuntBattleInit,
    private readonly rules: BattleRules,
    private readonly random: RandomSource,
  ) {
    this.playerHpValue = init.playerMaxHp;
    this.botHpValue = init.botMaxHp;
    if (!init.areaId) throw new Error("Battle area is required");
    requireWireIdentity(init.accountId, "account id");
    requireWireIdentity(init.heroId, "hero id");
    requireWireIdentity(init.botArtikulId, "bot artikul id");
    requireWireIdentity(init.botFightId, "bot fight id");
    if (init.botFightId === init.heroId) {
      throw new Error("Fight bot id collides with the human participant id");
    }
    if (init.botFightId < 1_000_000) {
      throw new Error("Fight bot id is below the ephemeral floor");
    }
    if (!Number.isInteger(init.heroLevel) || init.heroLevel < 1) {
      throw new Error("Battle hero level must be positive");
    }
    if (!Number.isInteger(init.heroKind) || init.heroKind < 1) {
      throw new Error("Battle hero kind must be positive");
    }
    if (rules.playerDamageMin < 0 || rules.playerDamageMax < rules.playerDamageMin) {
      throw new Error("Player damage rules are invalid");
    }
    if (rules.botDamageMin < 0 || rules.botDamageMax < rules.botDamageMin) {
      throw new Error("Bot damage rules are invalid");
    }
    if (rules.turnTimeoutSeconds < 1) throw new Error("Turn timeout must be positive");
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

  authenticate(): readonly BattleEvent[] {
    if (this.finishedValue) throw new Error("Cannot authenticate a finished battle");
    if (this.authenticated) throw new Error("Fight session is already authenticated");
    this.authenticated = true;
    return [
      this.opponentPacket(),
      { type: "turn-granted", timeoutSeconds: this.rules.turnTimeoutSeconds },
    ];
  }

  strike(side: "left" | "center" | "right"): readonly BattleEvent[] {
    if (!this.authenticated) throw new Error("Fight session is not authenticated");
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
      killed: this.botHpValue === 0,
    };
    if (this.botHpValue === 0) {
      this.finishedValue = true;
      return [
        playerCast,
        {
          type: "finished",
          winnerTeam: 1,
          fightId: this.id,
        },
      ];
    }

    const botDamage = this.random.integer(this.rules.botDamageMin, this.rules.botDamageMax);
    this.playerHpValue = Math.max(0, this.playerHpValue - botDamage);
    const botCast: BattleEvent = {
      type: "damage",
      sourceId: this.botFightId,
      targetId: this.heroId,
      animation: "attack_center",
      hpChange: -botDamage,
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

  opponentPacket(): BattleEvent {
    return {
      type: "opponent-introduced",
      id: this.botFightId,
      nick: this.botNick,
      hp: this.botHpValue,
      maxHp: this.init.botMaxHp,
      level: this.botLevel,
      team: 2,
    };
  }
}
