export type HeroCreationPolicy = Readonly<{
  level: number;
  hp: number;
  maxHp: number;
  areaId: string;
  moneyMinor: number;
}>;

export class Hero {
  private constructor(
    readonly id: string,
    readonly accountId: string,
    readonly nick: string,
    private levelValue: number,
    private hpValue: number,
    private maxHpValue: number,
    private areaIdValue: string,
    private moneyMinorValue: number,
  ) {}

  static assertCreationPolicy(policy: HeroCreationPolicy): void {
    if (policy.level < 1) throw new Error("Hero creation level must be positive");
    if (policy.maxHp < 1 || policy.hp < 0 || policy.hp > policy.maxHp) {
      throw new Error("Hero creation HP policy is invalid");
    }
    if (!policy.areaId) throw new Error("Hero creation area is required");
    if (policy.moneyMinor < 0) throw new Error("Hero creation money cannot be negative");
  }

  static restore(values: {
    id: string;
    accountId: string;
    nick: string;
    level: number;
    hp: number;
    maxHp: number;
    areaId: string;
    moneyMinor: number;
  }): Hero {
    return new Hero(
      values.id,
      values.accountId,
      values.nick,
      values.level,
      values.hp,
      values.maxHp,
      values.areaId,
      values.moneyMinor,
    );
  }

  get level(): number {
    return this.levelValue;
  }
  get hp(): number {
    return this.hpValue;
  }
  get maxHp(): number {
    return this.maxHpValue;
  }
  get areaId(): string {
    return this.areaIdValue;
  }
  get moneyMinor(): number {
    return this.moneyMinorValue;
  }

  takeDamage(amount: number): void {
    this.hpValue = Math.max(0, this.hpValue - Math.max(0, Math.floor(amount)));
  }

  healFully(): void {
    this.hpValue = this.maxHpValue;
  }
}
