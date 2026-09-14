import {
  requireCombatLoadout,
  type CombatGloveSpell,
  type CombatLoadout,
  type CombatPocketRow,
  type CombatSpell,
} from "./combat-loadout.ts";
import type { PocketCellSnapshot } from "./fight-outcome-snapshot.ts";
import type { SchoolOverlay } from "./school-overlay.ts";

type PocketRuntime = {
  readonly row: CombatPocketRow;
  count: number;
  lastUseAt: number;
};

export class HuntHumanCastState {
  cp = 0;
  rage = 0;
  aggro: number;
  private orbHits = 0;
  private orbPcStr = 0;
  private gloveCritHits = 0;
  schoolOverlay: SchoolOverlay | null = null;
  private readonly pockets = new Map<number, PocketRuntime>();
  private readonly groupLastUseAt = new Map<number, number>();

  constructor(
    readonly loadout: CombatLoadout,
    aggroCharges: number,
  ) {
    requireCombatLoadout(loadout);
    if (!Number.isInteger(aggroCharges) || aggroCharges < 0) {
      throw new Error("Hunt aggro charges must be a non-negative integer");
    }
    this.aggro = aggroCharges;
    for (const row of loadout.pocket) {
      this.pockets.set(row.itemId, { row, count: row.count, lastUseAt: 0 });
    }
  }

  pocketRow(itemId: number): CombatPocketRow | null {
    return this.pockets.get(itemId)?.row ?? null;
  }

  pocketCount(itemId: number): number {
    return this.pockets.get(itemId)?.count ?? 0;
  }

  pocketCells(): readonly PocketCellSnapshot[] {
    return [...this.pockets.values()].map((pocket) => ({
      itemId: pocket.row.itemId,
      artifactId: pocket.row.artifactId,
      position: pocket.row.position,
      startCount: pocket.row.count,
      currentCount: pocket.count,
    }));
  }

  consumePocket(itemId: number, nowMs: number): CombatPocketRow {
    const pocket = this.pockets.get(itemId);
    if (!pocket) throw new Error(`Pocket item ${itemId} is not in the fight loadout`);
    if (pocket.count < 1) throw new Error(`Pocket item ${itemId} is empty`);
    pocket.count -= 1;
    pocket.lastUseAt = nowMs;
    const groupId = pocket.row.spell.groupId;
    if (groupId) this.groupLastUseAt.set(groupId, nowMs);
    return pocket.row;
  }

  cooldownLeftMs(itemId: number, nowMs: number): number {
    const pocket = this.pockets.get(itemId);
    if (!pocket) throw new Error(`Pocket item ${itemId} is not in the fight loadout`);
    const cooldownSec = pocket.row.spell.cooldown;
    if (!cooldownSec || cooldownSec <= 0) return 0;
    const last = Math.max(
      pocket.lastUseAt,
      pocket.row.spell.groupId ? (this.groupLastUseAt.get(pocket.row.spell.groupId) ?? 0) : 0,
    );
    if (last <= 0) return 0;
    return Math.max(0, cooldownSec * 1000 - (nowMs - last));
  }

  gloveSpell(artikulId: number): CombatGloveSpell | null {
    return this.loadout.glove?.spells.find((spell) => spell.artikulId === artikulId) ?? null;
  }

  get hits(): readonly number[] {
    return this.loadout.glove?.hits ?? [];
  }

  advanceCombo(side: "left" | "center" | "right"): number {
    const hits = this.hits;
    if (hits.length === 0) return this.cp;
    const expected = hits[this.cp];
    const code = side === "left" ? 1 : side === "center" ? 2 : 3;
    if (expected === code) {
      this.cp += 1;
      return this.cp;
    }
    if (this.cp > 0) this.cp = 0;
    return this.cp;
  }

  spendCombo(cost: number): number {
    if (!Number.isInteger(cost) || cost < 1) throw new Error("Glove cost must be positive");
    if (this.cp < cost) throw new Error("Glove combo cost exceeds current cp");
    this.cp -= cost;
    return this.cp;
  }

  armOrb(pcStr: number, hits: number): void {
    this.orbPcStr = pcStr;
    this.orbHits = hits;
  }

  takeOrbPcStr(): number {
    if (this.orbHits < 1) return 0;
    this.orbHits -= 1;
    const value = this.orbPcStr;
    if (this.orbHits === 0) this.orbPcStr = 0;
    return value;
  }

  armGloveCrit(hits: number): void {
    this.gloveCritHits = hits;
  }

  takeGloveCrit(): boolean {
    if (this.gloveCritHits < 1) return false;
    this.gloveCritHits -= 1;
    return true;
  }

  awardIncomingRage(damage: number, maxHp: number): number {
    if (!Number.isInteger(damage) || damage < 0) throw new Error("Rage damage is invalid");
    if (!Number.isInteger(maxHp) || maxHp < 1) throw new Error("Rage maxHp is invalid");
    const delta = (damage * 100) / (1.75 * maxHp);
    this.rage = Math.min(100, this.rage + delta);
    return delta;
  }

  spendRage(): number {
    const fill = this.rage;
    this.rage = 0;
    return fill;
  }

  spendAggro(): number {
    if (this.aggro < 1) {
      throw new Error("Hunt aggro has no remaining charges");
    }
    this.aggro -= 1;
    return this.aggro;
  }
}

export function pocketHealAmount(spell: CombatSpell, maxHp: number): number {
  const heal = spell.effects.find((effect) => effect.kind === 2);
  if (!heal || heal.amount === undefined) throw new Error("Heal spell amount is required");
  if (typeof heal.amount === "number") return heal.amount;
  const text = heal.amount.trim();
  if (!text.endsWith("%")) throw new Error("Heal spell amount is invalid");
  const pct = Number(text.slice(0, -1));
  if (!Number.isFinite(pct)) throw new Error("Heal spell percent is invalid");
  return Math.floor((maxHp * pct) / 100);
}

export function spellPcStr(spell: CombatSpell): number {
  for (const effect of spell.effects) {
    const skill = effect.skills?.find((entry) => entry.skillId === "pcSTR");
    if (skill) return skill.value;
  }
  return 0;
}

export function spellCharging(spell: CombatSpell): number {
  for (const effect of spell.effects) {
    const value = effect.charging;
    if (value && value > 0) return value;
  }
  return 0;
}

export function spellKind(spell: CombatSpell, kind: number): boolean {
  return spell.effects.some((effect) => effect.kind === kind);
}
