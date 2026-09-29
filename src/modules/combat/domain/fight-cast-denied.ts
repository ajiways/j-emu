export class FightCastDenied extends Error {
  constructor(
    readonly deny: "cooldown" | "kind11" | "pvp-only",
    readonly sequence: string | number,
  ) {
    super(DENY_MESSAGES[deny]);
    this.name = "FightCastDenied";
  }
}

const DENY_MESSAGES = {
  cooldown: "pocket cooldown",
  kind11: "kind 11 requires a target",
  "pvp-only": "spell is only for PvP fights",
} as const;
