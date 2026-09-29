import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";

/** One live pairing inside a Battle: human↔bot, human↔human, or bot↔bot. */
export class FightDuel {
  private hitsAValue = 0;
  private hitsBValue = 0;
  private lastCountedId: number | null = null;
  private nextActorIdValue: number;

  constructor(
    private aIdValue: number,
    private bIdValue: number,
    nextActorId: number,
  ) {
    requireWireIdentity(aIdValue, "duel a id");
    requireWireIdentity(bIdValue, "duel b id");
    if (aIdValue === bIdValue) throw new Error("Duel sides must be distinct");
    this.requireSide(nextActorId, "duel next actor");
    this.nextActorIdValue = nextActorId;
  }

  get aId(): number {
    return this.aIdValue;
  }
  get bId(): number {
    return this.bIdValue;
  }
  get hitsA(): number {
    return this.hitsAValue;
  }
  get hitsB(): number {
    return this.hitsBValue;
  }
  get nextActorId(): number {
    return this.nextActorIdValue;
  }

  has(id: number): boolean {
    return this.aIdValue === id || this.bIdValue === id;
  }

  otherId(id: number): number {
    this.requireSide(id, "duel participant");
    return this.aIdValue === id ? this.bIdValue : this.aIdValue;
  }

  hitsFor(id: number): number {
    this.requireSide(id, "duel participant");
    return this.aIdValue === id ? this.hitsAValue : this.hitsBValue;
  }

  /**
   * Books one turn of `attackerId` for the shuffle counter. Consecutive turns of the same
   * fighter (the opponent was stunned in between) count once.
   */
  addHit(attackerId: number): void {
    this.requireSide(attackerId, "duel attacker");
    if (this.lastCountedId === attackerId) return;
    this.lastCountedId = attackerId;
    if (this.aIdValue === attackerId) this.hitsAValue += 1;
    else this.hitsBValue += 1;
  }

  resetHits(): void {
    this.hitsAValue = 0;
    this.hitsBValue = 0;
    this.lastCountedId = null;
  }

  setNextActor(id: number): void {
    this.requireSide(id, "duel next actor");
    this.nextActorIdValue = id;
  }

  replace(oldId: number, nextId: number): void {
    this.requireSide(oldId, "duel replace source");
    requireWireIdentity(nextId, "duel replace target");
    if (nextId === oldId) throw new Error("Duel replace target must be a new id");
    if (this.has(nextId)) throw new Error("Duel replace target is already in the pair");
    if (this.aIdValue === oldId) this.aIdValue = nextId;
    else this.bIdValue = nextId;
    if (this.nextActorIdValue === oldId) this.nextActorIdValue = nextId;
    if (this.lastCountedId === oldId) this.lastCountedId = null;
  }

  private requireSide(id: number, label: string): void {
    requireWireIdentity(id, label);
    if (!this.has(id)) throw new Error(`${label} ${id} is not in this duel`);
  }
}
