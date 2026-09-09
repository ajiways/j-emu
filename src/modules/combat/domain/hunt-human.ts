import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";

export type HuntHumanSnap = Readonly<{
  id: number;
  nick: string;
  level: number;
  kind: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  team: 1;
}>;

type HuntHumanInit = Readonly<{
  accountId: number;
  heroId: number;
  nick: string;
  level: number;
  kind: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  team: 1;
  waiting: boolean;
}>;

export class HuntHuman {
  authed = false;
  private waitingValue: boolean;
  private turnActiveValue = false;
  private hpValue: number;

  constructor(private readonly init: HuntHumanInit) {
    requireHuntHumanInit(init);
    this.waitingValue = init.waiting;
    this.hpValue = init.hp;
  }

  get accountId(): number {
    return this.init.accountId;
  }
  get heroId(): number {
    return this.init.heroId;
  }
  get nick(): string {
    return this.init.nick;
  }
  get level(): number {
    return this.init.level;
  }
  get kind(): number {
    return this.init.kind;
  }
  get hp(): number {
    return this.hpValue;
  }
  get maxHp(): number {
    return this.init.maxHp;
  }
  get mp(): number {
    return this.init.mp;
  }
  get maxMp(): number {
    return this.init.maxMp;
  }
  get team(): 1 {
    return this.init.team;
  }
  get waiting(): boolean {
    return this.waitingValue;
  }
  get turnActive(): boolean {
    return this.turnActiveValue;
  }

  pair(): void {
    if (!this.waitingValue) throw new Error("Hunt human is already paired");
    this.waitingValue = false;
  }

  beginTurn(): void {
    this.turnActiveValue = true;
  }

  endTurn(): void {
    this.turnActiveValue = false;
  }

  snapshot(): HuntHumanSnap {
    return {
      id: this.heroId,
      nick: this.nick,
      level: this.level,
      kind: this.kind,
      hp: this.hpValue,
      maxHp: this.maxHp,
      mp: this.mp,
      maxMp: this.maxMp,
      team: this.team,
    };
  }

  applyDamage(amount: number): boolean {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error("Hunt human damage must be a non-negative integer");
    }
    this.hpValue = Math.max(0, this.hpValue - amount);
    return this.hpValue === 0;
  }
}

function requireHuntHumanInit(init: HuntHumanInit): void {
  requireWireIdentity(init.accountId, "account id");
  requireWireIdentity(init.heroId, "hero id");
  if (!init.nick) throw new Error("Hunt human nick is required");
  if (!Number.isInteger(init.level) || init.level < 1) {
    throw new Error("Hunt human level must be positive");
  }
  if (!Number.isInteger(init.kind) || init.kind < 1) {
    throw new Error("Hunt human kind must be positive");
  }
  if (!Number.isInteger(init.hp) || init.hp < 1) {
    throw new Error("Hunt human hp must be positive");
  }
  if (!Number.isInteger(init.maxHp) || init.maxHp < init.hp) {
    throw new Error("Hunt human maxHp is invalid");
  }
  if (!Number.isInteger(init.mp) || init.mp < 0) {
    throw new Error("Hunt human mp is invalid");
  }
  if (!Number.isInteger(init.maxMp) || init.maxMp < 1 || init.mp > init.maxMp) {
    throw new Error("Hunt human maxMp is invalid");
  }
  if (init.team !== 1) throw new Error("Hunt human team must be 1");
}
