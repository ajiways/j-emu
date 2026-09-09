import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { isProgressionManagedSkillId } from "../../content/domain/progression-managed-skills.ts";
import { FIGHT_INJURY_ARTIKUL_ID } from "./fight-injury-wire.ts";
import { type HeroCreationPolicy, type HeroRecord, type NewHero } from "./hero-record.ts";
import { debitMoneyMinor } from "./debit-money-minor.ts";
import { nextMoneyMinor } from "./next-money-minor.ts";

export type { HeroCreationPolicy, HeroRecord, NewHero };

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
    private regenAtValue: Date,
    private moveReadyAtValue: Date | null,
    private ghostValue: boolean,
    private injuryTimeValue: number,
    private injuryArtikulIdValue: number,
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
    if (policy.honor < 0) {
      throw new Error("Hero creation honor cannot be negative");
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
    requireGhostState(values.ghost, values.injuryTime, values.injuryArtikulId);
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
      values.regenAt,
      values.moveReadyAt,
      values.ghost,
      values.injuryTime,
      values.injuryArtikulId,
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
  get regenAt(): Date {
    return this.regenAtValue;
  }
  get moveReadyAt(): Date | null {
    return this.moveReadyAtValue;
  }
  get ghost(): boolean {
    return this.ghostValue;
  }
  get injuryTime(): number {
    return this.injuryTimeValue;
  }
  get injuryArtikulId(): number {
    return this.injuryArtikulIdValue;
  }

  setArea(areaId: string, moveReadyAt: Date | null): void {
    if (!areaId) throw new Error("Hero area is required");
    if (moveReadyAt !== null) {
      if (!(moveReadyAt instanceof Date) || !Number.isFinite(moveReadyAt.getTime())) {
        throw new Error("Hero move_ready_at must be a valid timestamp");
      }
    }
    this.areaIdValue = areaId;
    this.moveReadyAtValue = moveReadyAt;
  }

  applyResourceClock(hp: number, hpTime: number, regenAt: Date): void {
    this.setHp(hp);
    this.setHpTime(hpTime);
    if (!(regenAt instanceof Date) || !Number.isFinite(regenAt.getTime())) {
      throw new Error("Hero regen_at must be a valid timestamp");
    }
    this.regenAtValue = regenAt;
  }

  applyDefeat(injuryUntilUnix: number, regenAt: Date): void {
    if (this.ghostValue) throw new Error("Hero is already ghosted");
    if (!Number.isInteger(injuryUntilUnix) || injuryUntilUnix < 1) {
      throw new Error("Hero injury_time must be a positive unix timestamp");
    }
    this.setHp(0);
    this.setHpTime(0);
    if (!(regenAt instanceof Date) || !Number.isFinite(regenAt.getTime())) {
      throw new Error("Hero regen_at must be a valid timestamp");
    }
    this.regenAtValue = regenAt;
    this.ghostValue = true;
    this.injuryTimeValue = injuryUntilUnix;
    this.injuryArtikulIdValue = FIGHT_INJURY_ARTIKUL_ID;
  }

  clearGhost(): void {
    if (!this.ghostValue) throw new Error("Hero is not ghosted");
    this.ghostValue = false;
    this.injuryTimeValue = 0;
    this.injuryArtikulIdValue = 0;
  }

  setHpTime(hpTime: number): void {
    if (!Number.isInteger(hpTime) || hpTime < 0) {
      throw new Error("Hero hpTime must be a non-negative integer");
    }
    this.hpTimeValue = hpTime;
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

  creditMoney(minorUnits: number): void {
    this.moneyMinorValue = nextMoneyMinor(this.moneyMinorValue, minorUnits);
  }

  debitMoney(minorUnits: number): void {
    this.moneyMinorValue = debitMoneyMinor(this.moneyMinorValue, minorUnits);
  }

  private setHp(hp: number): void {
    if (!Number.isInteger(hp) || hp < 0 || hp > this.maxHpValue) {
      throw new Error("Hero HP must be an integer in [0, maxHp]");
    }
    this.hpValue = hp;
  }
}

function requireGhostState(ghost: boolean, injuryTime: number, injuryArtikulId: number): void {
  if (typeof ghost !== "boolean") throw new Error("Hero ghost must be a boolean");
  if (!Number.isInteger(injuryTime) || injuryTime < 0) {
    throw new Error("Hero injury_time must be a non-negative integer");
  }
  if (!Number.isInteger(injuryArtikulId) || injuryArtikulId < 0) {
    throw new Error("Hero injury_artikul_id must be a non-negative integer");
  }
  if (ghost) {
    if (injuryArtikulId !== FIGHT_INJURY_ARTIKUL_ID) {
      throw new Error(`Hero injury_artikul_id must be ${FIGHT_INJURY_ARTIKUL_ID} when ghosted`);
    }
    if (injuryTime < 1) throw new Error("Hero injury_time must be positive when ghosted");
    return;
  }
  if (injuryTime !== 0 || injuryArtikulId !== 0) {
    throw new Error("Hero injury fields must be 0 when not ghosted");
  }
}

function scaleResource(current: number, previousMax: number, nextMax: number): number {
  if (previousMax > 0) return Math.min(nextMax, Math.round((current / previousMax) * nextMax));
  return Math.min(current, nextMax);
}
