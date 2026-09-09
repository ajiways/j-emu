export class BrokenItemError extends Error {
  constructor() {
    super("Эту вещь нельзя надеть!");
    this.name = "BrokenItemError";
  }
}
