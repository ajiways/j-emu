import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { CombatLoadout } from "./combat-loadout.ts";
import { HuntHumanCastState } from "./hunt-human-cast-state.ts";
import type { PocketCellSnapshot } from "./fight-outcome-snapshot.ts";

export type HuntHumanAppearance = Readonly<{
  avatar: string;
  body: string;
  sk: string;
}>;

export type HuntHumanSnap = Readonly<{
  id: number;
  nick: string;
  level: number;
  kind: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  team: 1 | 2;
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
  team: 1 | 2;
  waiting: boolean;
  strength: number;
  loadout: CombatLoadout;
  appearance: HuntHumanAppearance | null;
}>;

export class HuntHuman {
  authed = false;
  readonly casts: HuntHumanCastState;
  private waitingValue: boolean;
  private turnActiveValue = false;
  private turnDeadlineMsValue: number | null = null;
  private resumeBootstrapValue = false;
  private hpValue: number;
  private damageToBotValue = 0;
  private leftLiveValue = false;

  constructor(private readonly init: HuntHumanInit) {
    requireHuntHumanInit(init);
    this.waitingValue = init.waiting;
    this.hpValue = init.hp;
    this.casts = new HuntHumanCastState(init.loadout);
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
  get strength(): number {
    return this.init.strength;
  }
  get team(): 1 | 2 {
    return this.init.team;
  }
  get appearance(): HuntHumanAppearance | null {
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

  endTurn(): void {
    this.turnActiveValue = false;
    this.turnDeadlineMsValue = null;
  }

  markLeft(): void {
    this.leftLiveValue = true;
    this.waitingValue = false;
    this.turnActiveValue = false;
    this.turnDeadlineMsValue = null;
    this.resumeBootstrapValue = false;
  }

  creditDamageToBot(amount: number): void {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error("Hunt human damage to bot must be a non-negative integer");
    }
    this.damageToBotValue += amount;
  }

  pocketCells(): readonly PocketCellSnapshot[] {
    return this.casts.pocketCells();
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

  applyHeal(amount: number): number {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error("Hunt human heal must be a non-negative integer");
    }
    const before = this.hpValue;
    this.hpValue = Math.min(this.maxHp, this.hpValue + amount);
    return this.hpValue - before;
  }
}

function requireAppearance(appearance: HuntHumanAppearance): void {
  if (!appearance.avatar) throw new Error("Hunt human avatar is required");
  if (typeof appearance.body !== "string") throw new Error("Hunt human body is required");
  if (!appearance.sk) throw new Error("Hunt human sk is required");
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
  if (init.team !== 1 && init.team !== 2) throw new Error("Hunt human team must be 1 or 2");
  if (init.appearance) requireAppearance(init.appearance);
  if (!Number.isInteger(init.strength) || init.strength < 1) {
    throw new Error("Hunt human strength must be positive");
  }
}
