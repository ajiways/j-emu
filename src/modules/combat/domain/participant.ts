import { CastState } from "./cast-state.ts";
import type { CombatLoadout } from "./combat-loadout.ts";
import type { FightEffectIds } from "./fight-effect-ids.ts";
import { FighterEffects } from "./fighter-effects.ts";
import type { Fighter, FighterKind } from "./fighter.ts";
import type { MagStats } from "./mag-stats.ts";
import { strikeStatsOf, type StrikeStats } from "./melee-outcome.ts";

export type ParticipantInit = Readonly<{
  id: number;
  nick: string;
  level: number;
  team: 1 | 2;
  waiting: boolean;
  hp: number;
  maxHp: number;
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
  /** What the participant can cast and carry; a mob's is empty. */
  loadout: CombatLoadout;
  effectIds: FightEffectIds;
}>;

/**
 * One fight participant, whoever controls it. The fight rules — stats, effects, hit points,
 * damage, stun, rage, combo, who waits and who is paired — are the same for a hero and a mob;
 * what a participant may do differs only through what it carries (`loadout`) and through its
 * controller: a player's commands or an AI's decisions.
 */
export abstract class Participant implements Fighter {
  readonly casts: CastState;
  readonly effects: FighterEffects;
  stunnedTurns = 0;
  private hpValue: number;
  private waitingValue: boolean;
  private damageToBotValue = 0;
  private damageToHumansValue = 0;
  private lastOpponentIdValue: number | null = null;

  protected constructor(protected readonly init: ParticipantInit) {
    requireParticipantInit(init);
    this.hpValue = init.hp;
    this.waitingValue = init.waiting;
    this.casts = new CastState(init.loadout, init.aggroCharges);
    this.effects = new FighterEffects({
      heroId: init.id,
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

  abstract get fighterKind(): FighterKind;

  get id(): number {
    return this.init.id;
  }
  get nick(): string {
    return this.init.nick;
  }
  get level(): number {
    return this.init.level;
  }
  get team(): 1 | 2 {
    return this.init.team;
  }
  get hp(): number {
    return this.hpValue;
  }
  get maxHp(): number {
    return Math.max(1, this.init.maxHp + this.effects.standingSkill("HPMAX"));
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
  /** What this participant strikes and defends with now. */
  strikeStats(): StrikeStats {
    return strikeStatsOf(this);
  }
  meleeStrength(): number {
    return this.init.strength + this.effects.standingSkill("STR");
  }
  /** Still in the fight and on his feet: not dead and not gone. */
  get alive(): boolean {
    return this.hpValue > 0 && !this.departed;
  }

  /** Left the fight for good; a player can, a mob cannot. */
  protected get departed(): boolean {
    return false;
  }

  get waiting(): boolean {
    return this.waitingValue;
  }
  get lastOpponentId(): number | null {
    return this.lastOpponentIdValue;
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

  /** A stat with the flat skills of every standing effect, never below zero. */
  private stat(base: number, skillId: string): number {
    return Math.max(0, base + this.effects.standingSkill(skillId));
  }

  /** Rage a received hit adds, more while a `RAGE_MOD` effect stands. Returns the rage gained. */
  awardIncomingRage(damage: number): number {
    return this.casts.awardIncomingRage(
      damage,
      this.maxHp,
      this.effects.standingSkill("RAGE_MOD") + this.effects.standingSkill("pcRAGE_MOD"),
    );
  }

  pair(): void {
    if (!this.waitingValue) throw new Error(`Participant ${this.id} is already paired`);
    this.waitingValue = false;
  }

  unpair(): void {
    if (this.waitingValue) throw new Error(`Participant ${this.id} is already waiting`);
    this.waitingValue = true;
  }

  /** The waiting flag of a participant that leaves the pairing for good. */
  protected clearWaiting(): void {
    this.waitingValue = false;
  }

  markFought(opponentId: number): void {
    if (!Number.isInteger(opponentId) || opponentId < 1) {
      throw new Error("Last opponent id must be a positive integer");
    }
    this.lastOpponentIdValue = opponentId;
  }

  creditDealt(amount: number, targetKind: FighterKind): void {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error("Dealt damage must be a non-negative integer");
    }
    if (targetKind === "bot") this.damageToBotValue += amount;
    else this.damageToHumansValue += amount;
  }

  applyDamage(amount: number): boolean {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error("Damage must be a non-negative integer");
    }
    this.hpValue = Math.max(0, this.hpValue - amount);
    return this.hpValue === 0;
  }

  clampToMaxHp(): void {
    this.hpValue = Math.min(this.hpValue, this.maxHp);
  }

  applyHeal(amount: number): number {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error("Heal must be a non-negative integer");
    }
    const before = this.hpValue;
    this.hpValue = Math.min(this.maxHp, this.hpValue + amount);
    return this.hpValue - before;
  }

  /** Sets hit points outright: a scenario or a restore, not a hit. */
  setHp(hp: number): void {
    if (!Number.isInteger(hp) || hp < 0 || hp > this.maxHp) {
      throw new Error(`Participant ${this.id} hp is invalid`);
    }
    this.hpValue = hp;
  }
}

function requireParticipantInit(init: ParticipantInit): void {
  if (!init.nick) throw new Error("Participant nick is required");
  if (!Number.isInteger(init.level) || init.level < 1) {
    throw new Error("Participant level must be positive");
  }
  if (init.team !== 1 && init.team !== 2) throw new Error("Participant team must be 1 or 2");
  if (!Number.isInteger(init.maxHp) || init.maxHp < 1) {
    throw new Error("Participant maxHp is invalid");
  }
  if (!Number.isInteger(init.hp) || init.hp < 0 || init.hp > init.maxHp) {
    throw new Error("Participant hp is invalid");
  }
  if (!Number.isInteger(init.strength) || init.strength < 1) {
    throw new Error("Participant strength must be positive");
  }
  for (const [label, value] of [
    ["initiative", init.initiative],
    ["rage", init.rage],
    ["dexterity", init.dexterity],
    ["defense", init.defense],
    ["block", init.block],
    ["aggro charges", init.aggroCharges],
    ["mag power", init.magPower],
    ["mag resist", init.magResist],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Participant ${label} must be a non-negative integer`);
    }
  }
}
