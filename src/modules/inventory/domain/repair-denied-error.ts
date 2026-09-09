export class RepairDeniedError extends Error {
  constructor() {
    super("нельзя починить");
    this.name = "RepairDeniedError";
  }
}
