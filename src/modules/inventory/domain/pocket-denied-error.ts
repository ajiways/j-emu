export class PocketDeniedError extends Error {
  static readonly noFreeSlot = "Нет свободных ячеек в боевом инвентаре";
  static readonly cannotWear = "Этот предмет нельзя надеть";

  constructor(message: string) {
    super(message);
    this.name = "PocketDeniedError";
  }

  static noCells(): PocketDeniedError {
    return new PocketDeniedError(PocketDeniedError.noFreeSlot);
  }

  static notWearable(): PocketDeniedError {
    return new PocketDeniedError(PocketDeniedError.cannotWear);
  }
}
