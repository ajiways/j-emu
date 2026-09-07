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

export class Battle {
  private playerHpValue: number;
  private botHpValue: number;
  private authenticated = false;
  private finishedValue = false;

  constructor(
    readonly id: string,
    readonly accessKey: string,
    readonly accountId: string,
    readonly heroId: string,
    readonly heroFightId: number,
    readonly heroNick: string,
    readonly botId: number,
    readonly botNick: string,
    readonly botLevel: number,
    readonly playerMaxHp: number,
    readonly botMaxHp: number,
    readonly arena: string,
    private readonly rules: BattleRules,
    private readonly random: RandomSource,
  ) {
    this.playerHpValue = playerMaxHp;
    this.botHpValue = botMaxHp;
    if (rules.playerDamageMin < 0 || rules.playerDamageMax < rules.playerDamageMin) {
      throw new Error("Player damage rules are invalid");
    }
    if (rules.botDamageMin < 0 || rules.botDamageMax < rules.botDamageMin) {
      throw new Error("Bot damage rules are invalid");
    }
    if (rules.turnTimeoutSeconds < 1) throw new Error("Turn timeout must be positive");
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
      sourceId: this.heroFightId,
      targetId: this.botId,
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
      sourceId: this.botId,
      targetId: this.heroFightId,
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
      id: this.botId,
      nick: this.botNick,
      hp: this.botHpValue,
      maxHp: this.botMaxHp,
      level: this.botLevel,
      team: 2,
    };
  }
}
