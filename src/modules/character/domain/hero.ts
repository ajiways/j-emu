import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { isProgressionManagedSkillId } from "../../content/domain/progression-managed-skills.ts";

type StarterSkill = Readonly<{ id: string; value: number }>;

export type HeroCreationPolicy = Readonly<{
  exp: number;
  areaId: string;
  moneyMinor: number;
  moneyGoldMinor: number;
  kind: number;
  gender: number;
  language: string;
  body: string;
  sk: number;
  honor: number;
  hpTime: number;
  tutorialInfo: Readonly<{
    finished_first_fight: string;
    tutorial2: string;
  }>;
  skills: readonly StarterSkill[];
}>;

export type HeroRecord = Readonly<{
  id: number;
  accountId: number;
  nick: string;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  exp: number;
  areaId: string;
  moneyMinor: number;
  moneyGoldMinor: number;
  kind: number;
  gender: number;
  language: string;
  body: string;
  sk: number;
  honor: number;
  hpTime: number;
}>;

export type NewHero = Omit<HeroRecord, "id">;

export class Hero {
  private constructor(
    readonly id: number,
    readonly accountId: number,
    readonly nick: string,
    private levelValue: number,
    private hpValue: number,
    private maxHpValue: number,
    private mpValue: number,
    private maxMpValue: number,
    private expValue: number,
    private areaIdValue: string,
    private moneyMinorValue: number,
    private moneyGoldMinorValue: number,
    private kindValue: number,
    private genderValue: number,
    private languageValue: string,
    private bodyValue: string,
    private skValue: number,
    private honorValue: number,
    private hpTimeValue: number,
  ) {}

  static assertCreationPolicy(policy: HeroCreationPolicy): void {
    if (policy.exp !== 1) throw new Error("Hero creation EXP must be 1");
    if (!policy.areaId) throw new Error("Hero creation area is required");
    if (policy.moneyMinor < 0 || policy.moneyGoldMinor < 0) {
      throw new Error("Hero creation money cannot be negative");
    }
    if (policy.kind < 1) throw new Error("Hero creation kind must be positive");
    if (policy.gender < 1) throw new Error("Hero creation gender must be positive");
    if (!policy.language) throw new Error("Hero creation language is required");
    if (!policy.body) throw new Error("Hero creation body is required");
    if (policy.sk < 0) throw new Error("Hero creation sk cannot be negative");
    if (policy.honor < 0 || policy.hpTime < 0) {
      throw new Error("Hero creation honor and hpTime cannot be negative");
    }
    if (!policy.tutorialInfo.finished_first_fight || !policy.tutorialInfo.tutorial2) {
      throw new Error("Hero creation tutorial flags are required");
    }
    if (policy.skills.length < 1) throw new Error("Hero creation skills are required");
    const ids = new Set<string>();
    for (const skill of policy.skills) {
      if (!skill.id) throw new Error("Hero creation skill id is required");
      if (!Number.isInteger(skill.value) || skill.value < 0) {
        throw new Error(`Hero creation skill ${skill.id} value is invalid`);
      }
      if (ids.has(skill.id)) throw new Error(`Duplicate hero creation skill ${skill.id}`);
      if (isProgressionManagedSkillId(skill.id)) {
        throw new Error(`Hero creation policy must not include managed skill ${skill.id}`);
      }
      ids.add(skill.id);
    }
  }

  static restore(values: HeroRecord): Hero {
    return new Hero(
      requireWireIdentity(values.id, "hero id"),
      requireWireIdentity(values.accountId, "account id"),
      values.nick,
      values.level,
      values.hp,
      values.maxHp,
      values.mp,
      values.maxMp,
      values.exp,
      values.areaId,
      values.moneyMinor,
      values.moneyGoldMinor,
      values.kind,
      values.gender,
      values.language,
      values.body,
      values.sk,
      values.honor,
      values.hpTime,
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
  get mp(): number {
    return this.mpValue;
  }
  get maxMp(): number {
    return this.maxMpValue;
  }
  get exp(): number {
    return this.expValue;
  }
  get areaId(): string {
    return this.areaIdValue;
  }
  get moneyMinor(): number {
    return this.moneyMinorValue;
  }
  get moneyGoldMinor(): number {
    return this.moneyGoldMinorValue;
  }
  get kind(): number {
    return this.kindValue;
  }
  get gender(): number {
    return this.genderValue;
  }
  get language(): string {
    return this.languageValue;
  }
  get body(): string {
    return this.bodyValue;
  }
  get sk(): number {
    return this.skValue;
  }
  get honor(): number {
    return this.honorValue;
  }
  get hpTime(): number {
    return this.hpTimeValue;
  }

  applyProgression(exp: number, level: number, maxHp: number, maxMp: number): void {
    if (!Number.isInteger(exp) || exp < 0) {
      throw new Error("Hero EXP must be a non-negative integer");
    }
    if (!Number.isInteger(level) || level < 1) {
      throw new Error("Hero level must be a positive integer");
    }
    this.expValue = exp;
    this.levelValue = level;
    this.applyVitals(maxHp, maxMp);
  }

  applyVitals(maxHp: number, maxMp: number): void {
    if (!Number.isInteger(maxHp) || maxHp < 1) {
      throw new Error("Hero maxHp must be a positive integer");
    }
    if (!Number.isInteger(maxMp) || maxMp < 1) {
      throw new Error("Hero maxMp must be a positive integer");
    }
    this.hpValue = scaleResource(this.hpValue, this.maxHpValue, maxHp);
    this.mpValue = scaleResource(this.mpValue, this.maxMpValue, maxMp);
    this.maxHpValue = maxHp;
    this.maxMpValue = maxMp;
  }

  takeDamage(amount: number): void {
    this.hpValue = Math.max(0, this.hpValue - Math.max(0, Math.floor(amount)));
  }

  healFully(): void {
    this.hpValue = this.maxHpValue;
  }
}

function scaleResource(current: number, previousMax: number, nextMax: number): number {
  if (previousMax > 0) return Math.min(nextMax, Math.round((current / previousMax) * nextMax));
  return Math.min(current, nextMax);
}
