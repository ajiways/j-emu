export class FightEffectIds {
  private next = 1;

  take(): number {
    const id = this.next;
    if (!Number.isInteger(id) || id < 1) {
      throw new Error("Fight effect id must be a positive integer");
    }
    this.next += 1;
    return id;
  }
}
