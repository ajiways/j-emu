export class FightCastDenied extends Error {
  constructor(
    readonly deny: "cooldown" | "kind11",
    readonly sequence: string | number,
  ) {
    super(deny === "cooldown" ? "pocket cooldown" : "kind 11 requires a target");
    this.name = "FightCastDenied";
  }
}
