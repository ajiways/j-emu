import type { TradeItemSnapshot } from "../../../src/modules/trade/domain/trade-session.ts";
import type {
  HeldItemRecord,
  HeldItemsRepository,
} from "../../../src/modules/trade/ports/held-items-repository.ts";

export class FakeHeldItemsRepository implements HeldItemsRepository {
  private readonly rows = new Map<string, HeldItemRecord>();
  private nextId = 1;

  async upsertAdd(heroId: number, snapshot: TradeItemSnapshot): Promise<void> {
    const key = heldKey(heroId, snapshot.originalItemId);
    const existing = this.rows.get(key);
    if (existing) {
      this.rows.set(key, { ...existing, quantity: existing.quantity + snapshot.quantity });
      return;
    }
    this.rows.set(key, { id: this.nextId, heroId, ...snapshot });
    this.nextId += 1;
  }

  async lock(heroId: number, originalItemId: number): Promise<HeldItemRecord> {
    const row = this.rows.get(heldKey(heroId, originalItemId));
    if (!row) {
      throw new Error(`Trade held item for hero ${heroId} original ${originalItemId} is missing`);
    }
    return row;
  }

  async decrease(heroId: number, originalItemId: number, quantity: number): Promise<void> {
    const row = await this.lock(heroId, originalItemId);
    if (row.quantity < quantity) {
      throw new Error(
        `Trade held item for hero ${heroId} original ${originalItemId} has quantity ${row.quantity}, need ${quantity}`,
      );
    }
    if (row.quantity === quantity) {
      this.rows.delete(heldKey(heroId, originalItemId));
      return;
    }
    this.rows.set(heldKey(heroId, originalItemId), { ...row, quantity: row.quantity - quantity });
  }

  async deleteForHeroes(heroIds: readonly number[]): Promise<void> {
    const drop = new Set(heroIds);
    for (const [key, row] of this.rows) {
      if (drop.has(row.heroId)) this.rows.delete(key);
    }
  }

  async listAll(): Promise<readonly HeldItemRecord[]> {
    return [...this.rows.values()].sort((left, right) => left.id - right.id);
  }

  async deleteById(id: number): Promise<void> {
    for (const [key, row] of this.rows) {
      if (row.id !== id) continue;
      this.rows.delete(key);
      return;
    }
    throw new Error(`Trade held item ${id} delete missed the row`);
  }
}

function heldKey(heroId: number, originalItemId: number): string {
  return `${heroId}:${originalItemId}`;
}
