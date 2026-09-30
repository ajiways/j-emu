import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { CombatLoadout } from "./combat-loadout.ts";
import type { FightEffectIds } from "./fight-effect-ids.ts";
import { HumanCastState } from "./human-cast-state.ts";
import type { PocketCellSnapshot } from "./fight-outcome-snapshot.ts";
import { FighterEffects } from "./fighter-effects.ts";
import type { Fighter, FighterKind } from "./fighter.ts";
import type { MagStats } from "./mag-stats.ts";

export type FighterAppearance = Readonly<{
  avatar: string;
  body: string;
  sk: string;
}>;

export type HumanSnap = Readonly<{
  id: number;
  nick: string;
  level: number;
  kind: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  team: 1 | 2;
  dealtDamage: number;
}>;

type HumanFighterInit = Readonly<{
  accountId: number;
  heroId: number;
  nick: string;
  level: number;
  kind: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  team: 1 | 2;
  waiting: boolean;
  strength: number;
  initiative: number;
  rage: number;
  dexterity: number;
  defense: number;
  block: number;
  aggroCharges: number;
  magPower: number;
  magResist: number;
  startedAtMs: number;
  loadout: CombatLoadout;
  appearance: FighterAppearance;
  effectIds: FightEffectIds;
}>;

export class HumanFighter implements Fighter {
  authed = false;
  readonly casts: HumanCastState;
  readonly effects: FighterEffects;
  private waitingValue: boolean;
  private turnActiveValue = false;
  private turnDeadlineMsValue: number | null = null;
  private resumeBootstrapValue = false;
  private hpValue: number;
  private damageToBotValue = 0;
  private damageToHumansValue = 0;
  private leftLiveValue = false;
  private skipStreakValue = 0;
  private lastOpponentIdValue: number | null = null;
  stunnedTurns = 0;

  constructor(private readonly init: HumanFighterInit) {
    requireHuntHumanInit(init);
    this.waitingValue = init.waiting;
    this.hpValue = init.hp;
    this.casts = new HumanCastState(init.loadout, init.aggroCharges);
    this.effects = new FighterEffects({
      heroId: init.heroId,
      base: {
        STR: init.strength,
        DEX: init.dexterity,
        DEF: init.defense,
        RAG: init.rage,
        BLOK: init.block,
        HPMAX: init.maxHp,
      },
      startedAtMs: init.startedAtMs,
      gearSpells: init.loadout.gearSpells,
      effectIds: init.effectIds,
    });
  }

  get accountId(): number {
    return this.init.accountId;
  }
  get heroId(): number {
    return this.init.heroId;
  }
  get id(): number {
    return this.init.heroId;
  }
  get fighterKind(): FighterKind {
    return "human";
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
    return Math.max(1, this.init.maxHp + this.effects.standingSkill("HPMAX"));
  }
  get mp(): number {
    return this.init.mp;
  }
  get maxMp(): number {
    return this.init.maxMp;
  }
  get strength(): number {
    return this.init.strength;
  }
  get initiative(): number {
    return this.init.initiative;
  }
  /** The initiative that opens a duel: the base stat and what `LUCK` effects add now. */
  get currentInitiative(): number {
    return this.stat(this.init.initiative, "LUCK");
  }
  /** Rage a received hit adds, more while a `RAGE_MOD` effect stands. Returns the rage gained. */
  awardIncomingRage(damage: number): number {
    return this.casts.awardIncomingRage(
      damage,
      this.maxHp,
      this.effects.standingSkill("RAGE_MOD") + this.effects.standingSkill("pcRAGE_MOD"),
    );
  }
  get rageStat(): number {
    return this.stat(this.init.rage, "RAG");
  }
  get dexterity(): number {
    return this.stat(this.init.dexterity, "DEX");
  }
  get defense(): number {
    return this.stat(this.init.defense, "DEF");
  }
  get block(): number {
    return this.stat(this.init.block, "BLOK");
  }
  get mag(): MagStats {
    return { power: this.init.magPower, resist: this.init.magResist };
  }
  get lastOpponentId(): number | null {
    return this.lastOpponentIdValue;
  }
  meleeStrength(): number {
    return this.init.strength + this.effects.standingSkill("STR");
  }

  /** A stat with the flat skills of every standing effect, never below zero. */
  private stat(base: number, skillId: string): number {
    return Math.max(0, base + this.effects.standingSkill(skillId));
  }
  markFought(opponentId: number): void {
    if (!Number.isInteger(opponentId) || opponentId < 1) {
      throw new Error("Last opponent id must be a positive integer");
    }
    this.lastOpponentIdValue = opponentId;
  }
  get team(): 1 | 2 {
    return this.init.team;
  }
  get appearance(): FighterAppearance {
    return this.init.appearance;
  }
  get waiting(): boolean {
    return this.waitingValue;
  }
  get turnActive(): boolean {
    return this.turnActiveValue;
  }
  get damageToBot(): number {
    return this.damageToBotValue;
  }
  get damageToHumans(): number {
    return this.damageToHumansValue;
  }
  get dealtDamage(): number {
    return this.damageToBotValue + this.damageToHumansValue;
  }
  get leftLive(): boolean {
    return this.leftLiveValue;
  }

  pair(): void {
    if (!this.waitingValue) throw new Error("Hunt human is already paired");
    this.waitingValue = false;
  }

  unpair(): void {
    if (this.waitingValue) throw new Error("Hunt human is already waiting");
    this.waitingValue = true;
    this.endTurn();
  }

  markResume(): void {
    this.resumeBootstrapValue = true;
  }

  takeResume(): boolean {
    const resume = this.resumeBootstrapValue;
    this.resumeBootstrapValue = false;
    return resume;
  }

  beginTurn(nowMs: number, timeoutSeconds: number): void {
    if (!Number.isInteger(nowMs) || nowMs < 0) {
      throw new Error("Hunt human turn clock must be a non-negative integer");
    }
    if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1) {
      throw new Error("Hunt human turn timeout must be a positive integer");
    }
    this.turnActiveValue = true;
    this.turnDeadlineMsValue = nowMs + timeoutSeconds * 1000;
  }

  remainingTurnSeconds(nowMs: number): number | null {
    if (!this.turnActiveValue || this.turnDeadlineMsValue === null) return null;
    if (!Number.isInteger(nowMs) || nowMs < 0) {
      throw new Error("Hunt human turn clock must be a non-negative integer");
    }
    return Math.max(0, Math.ceil((this.turnDeadlineMsValue - nowMs) / 1000));
  }

  /** Real milliseconds this open turn has run; call before `endTurn`. */
  turnElapsedMs(nowMs: number, timeoutSeconds: number): number {
    if (!this.turnActiveValue || this.turnDeadlineMsValue === null) {
      throw new Error("Hunt human has no open turn");
    }
    return nowMs - (this.turnDeadlineMsValue - timeoutSeconds * 1000);
  }

  endTurn(): void {
    this.turnActiveValue = false;
    this.turnDeadlineMsValue = null;
  }

  /** An AFK timeout: returns how many turns in a row have now been skipped. */
  noteTimeout(): number {
    this.skipStreakValue += 1;
    return this.skipStreakValue;
  }

  /** A turn-ending action of the player breaks the AFK streak. */
  noteAction(): void {
    this.skipStreakValue = 0;
  }

  markLeft(): void {
    this.leftLiveValue = true;
    this.waitingValue = false;
    this.turnActiveValue = false;
    this.turnDeadlineMsValue = null;
    this.resumeBootstrapValue = false;
  }

  creditDealt(amount: number, targetKind: FighterKind): void {
    if (targetKind === "bot") this.creditDamageToBot(amount);
    else this.creditDamageToHumans(amount);
  }

  creditDamageToBot(amount: number): void {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error("Hunt human damage to bot must be a non-negative integer");
    }
    this.damageToBotValue += amount;
  }

  creditDamageToHumans(amount: number): void {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error("Hunt human damage to humans must be a non-negative integer");
    }
    this.damageToHumansValue += amount;
  }

  pocketCells(): readonly PocketCellSnapshot[] {
    return this.casts.pocketCells();
  }

  snapshot(): HumanSnap {
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
      dealtDamage: this.dealtDamage,
    };
  }

  applyDamage(amount: number): boolean {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error("Hunt human damage must be a non-negative integer");
    }
    this.hpValue = Math.max(0, this.hpValue - amount);
    return this.hpValue === 0;
  }

  clampToMaxHp(): void {
    this.hpValue = Math.min(this.hpValue, this.maxHp);
  }

  applyHeal(amount: number): number {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error("Hunt human heal must be a non-negative integer");
    }
    const before = this.hpValue;
    this.hpValue = Math.min(this.maxHp, this.hpValue + amount);
    return this.hpValue - before;
  }
}

function requireAppearance(appearance: FighterAppearance): void {
  if (!appearance.avatar) throw new Error("Hunt human avatar is required");
  if (typeof appearance.body !== "string") throw new Error("Hunt human body is required");
  if (!appearance.sk) throw new Error("Hunt human sk is required");
}

function requireHuntHumanInit(init: HumanFighterInit): void {
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
  if (init.team !== 1 && init.team !== 2) throw new Error("Hunt human team must be 1 or 2");
  requireAppearance(init.appearance);
  if (!Number.isInteger(init.strength) || init.strength < 1) {
    throw new Error("Hunt human strength must be positive");
  }
  requireNonNegative(init.initiative, "Hunt human initiative");
  requireNonNegative(init.rage, "Hunt human rage");
  requireNonNegative(init.dexterity, "Hunt human dexterity");
  requireNonNegative(init.defense, "Hunt human defense");
  requireNonNegative(init.block, "Hunt human block");
  requireNonNegative(init.aggroCharges, "Hunt human aggro charges");
  requireNonNegative(init.magPower, "Hunt human mag power");
  requireNonNegative(init.magResist, "Hunt human mag resist");
}

function requireNonNegative(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}
