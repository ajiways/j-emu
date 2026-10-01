/** Items a fight cast used up; the HTTP command that carried the cast takes and spends them. */
export class PendingConsumes {
  private readonly pocket = new Map<number, number>();
  private readonly bag = new Map<number, number>();

  setPocket(accountId: number, itemId: number): void {
    this.pocket.set(accountId, itemId);
  }

  setBag(accountId: number, itemId: number): void {
    this.bag.set(accountId, itemId);
  }

  takePocket(accountId: number): number | null {
    return takeOnce(this.pocket, accountId);
  }

  takeBag(accountId: number): number | null {
    return takeOnce(this.bag, accountId);
  }

  clear(): void {
    this.pocket.clear();
    this.bag.clear();
  }
}

function takeOnce(pending: Map<number, number>, accountId: number): number | null {
  const itemId = pending.get(accountId);
  if (itemId === undefined) return null;
  pending.delete(accountId);
  return itemId;
}
