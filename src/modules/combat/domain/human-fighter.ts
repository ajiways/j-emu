import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { CombatLoadout } from "./combat-loadout.ts";
import type { FightEffectIds } from "./fight-effect-ids.ts";
import type { PocketCellSnapshot } from "./fight-outcome-snapshot.ts";
import type { FighterKind } from "./fighter.ts";
import { Participant, type ParticipantInit } from "./participant.ts";

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

export class HumanFighter extends Participant {
  authed = false;
  private turnActiveValue = false;
  private turnDeadlineMsValue: number | null = null;
  private resumeBootstrapValue = false;
  private leftLiveValue = false;
  private skipStreakValue = 0;

  constructor(private readonly human: HumanFighterInit) {
    super(participantInitOf(human));
  }

  get fighterKind(): FighterKind {
    return "human";
  }

  get accountId(): number {
    return this.human.accountId;
  }
  get heroId(): number {
    return this.human.heroId;
  }
  get kind(): number {
    return this.human.kind;
  }
  get mp(): number {
    return this.human.mp;
  }
  get maxMp(): number {
    return this.human.maxMp;
  }
  get appearance(): FighterAppearance {
    return this.human.appearance;
  }
  get turnActive(): boolean {
    return this.turnActiveValue;
  }
  get leftLive(): boolean {
    return this.leftLiveValue;
  }

  protected override get departed(): boolean {
    return this.leftLiveValue;
  }

  override unpair(): void {
    super.unpair();
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
    this.clearWaiting();
    this.turnActiveValue = false;
    this.turnDeadlineMsValue = null;
    this.resumeBootstrapValue = false;
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
      hp: this.hp,
      maxHp: this.maxHp,
      mp: this.mp,
      maxMp: this.maxMp,
      team: this.team,
      dealtDamage: this.dealtDamage,
    };
  }
}

function requireAppearance(appearance: FighterAppearance): void {
  if (!appearance.avatar) throw new Error("Hunt human avatar is required");
  if (typeof appearance.body !== "string") throw new Error("Hunt human body is required");
  if (!appearance.sk) throw new Error("Hunt human sk is required");
}

function participantInitOf(init: HumanFighterInit): ParticipantInit {
  requireHuntHumanInit(init);
  return { ...init, id: init.heroId };
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
