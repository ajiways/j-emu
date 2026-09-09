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

  constructor(private readonly init: HuntHumanInit) {
    requireHuntHumanInit(init);
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
    return this.init.hp;
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
    return this.init.waiting;
  }

  snapshot(hp: number): HuntHumanSnap {
    if (!Number.isInteger(hp) || hp < 0 || hp > this.maxHp) {
      throw new Error("Hunt human snapshot hp is invalid");
    }
    return {
      id: this.heroId,
      nick: this.nick,
      level: this.level,
      kind: this.kind,
      hp,
      maxHp: this.maxHp,
      mp: this.mp,
      maxMp: this.maxMp,
      team: this.team,
    };
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
