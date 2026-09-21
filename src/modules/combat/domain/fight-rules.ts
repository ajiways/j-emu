const FIGHT_RULES_VERSION = 1;

export type FightTeamAssignment = Readonly<{
  openerTeam: 1 | 2;
  enemyTeam: 1 | 2;
}>;

type HumanJoinMode =
  | Readonly<{ mode: "denied"; reason: string }>
  | Readonly<{ mode: "hunt-roster" }>
  | Readonly<{ mode: "pvp-humans" }>;

type FightHistoryRow = "hunt-bot" | "practice-humans" | "none";

type FightRulesFields = Readonly<{
  version: typeof FIGHT_RULES_VERSION;
  teamAssignment: FightTeamAssignment;
  humanJoin: HumanJoinMode;
  canLeave: boolean;
  canAggro: boolean;
  skipQuestKills: boolean;
  allowsSideBots: boolean;
  shufflesAfterHits: boolean;
  // Queue pairing, not enemy bots: quest join is denied so this value is unobservable there.
  pairsNextWaiter: boolean;
  hasEnemyBots: boolean;
  awardsHonor: boolean;
  restoresFighters: boolean;
  historyRow: FightHistoryRow;
  includesQuestChat: boolean;
}>;

type FightRulesContext =
  | Readonly<{ kind: "hunt"; instanceCopyId: number | null }>
  | Readonly<{ kind: "quest"; botCount: number }>
  | Readonly<{ kind: "friendly-duel" }>
  | Readonly<{ kind: "pvp" }>;

export type FightKind = FightRulesContext["kind"];

/**
 * Permissions and consequences of a fight start. Numeric combat knobs stay on
 * `BattleRules`. Callers construct this at the start boundary and pass it in;
 * domain must not derive it from `purpose`/`kind`.
 */
export class FightRules implements FightRulesFields {
  readonly version!: typeof FIGHT_RULES_VERSION;
  readonly teamAssignment!: FightTeamAssignment;
  readonly humanJoin!: HumanJoinMode;
  readonly canLeave!: boolean;
  readonly canAggro!: boolean;
  readonly skipQuestKills!: boolean;
  readonly allowsSideBots!: boolean;
  readonly shufflesAfterHits!: boolean;
  readonly pairsNextWaiter!: boolean;
  readonly hasEnemyBots!: boolean;
  readonly awardsHonor!: boolean;
  readonly restoresFighters!: boolean;
  readonly historyRow!: FightHistoryRow;
  readonly includesQuestChat!: boolean;

  private constructor(fields: FightRulesFields) {
    assertFightRules(fields);
    Object.assign(this, fields);
  }

  static require(value: FightRules | null | undefined): FightRules {
    if (!(value instanceof FightRules)) {
      throw new Error("FightRules is required");
    }
    return value;
  }

  static create(fields: FightRulesFields): FightRules {
    return new FightRules(fields);
  }

  static for(context: FightRulesContext): FightRules {
    switch (context.kind) {
      case "hunt":
        return FightRules.forHunt(context.instanceCopyId);
      case "quest":
        return FightRules.forQuest(context.botCount);
      case "friendly-duel":
        return FightRules.forFriendlyDuel();
      case "pvp":
        return FightRules.forPvp();
      default: {
        const unknown = context as { kind?: unknown };
        throw new Error(`Unknown fight kind: ${String(unknown.kind)}`);
      }
    }
  }

  static forHunt(instanceCopyId: number | null): FightRules {
    if (instanceCopyId !== null && (!Number.isInteger(instanceCopyId) || instanceCopyId < 1)) {
      throw new Error("Hunt FightRules instanceCopyId must be a positive integer or null");
    }
    const inWorld = instanceCopyId === null;
    return FightRules.create({
      version: FIGHT_RULES_VERSION,
      teamAssignment: { openerTeam: 1, enemyTeam: 2 },
      humanJoin: { mode: "hunt-roster" },
      canLeave: inWorld,
      canAggro: inWorld,
      skipQuestKills: false,
      allowsSideBots: false,
      shufflesAfterHits: true,
      pairsNextWaiter: true,
      awardsHonor: false,
      restoresFighters: false,
      includesQuestChat: false,
      ...enemyBotsHistory(true),
    });
  }

  static forQuest(botCount: number): FightRules {
    if (!Number.isInteger(botCount) || botCount < 1) {
      throw new Error("Quest fight bot count must be a positive integer");
    }
    return FightRules.create({
      version: FIGHT_RULES_VERSION,
      teamAssignment: { openerTeam: 2, enemyTeam: 1 },
      humanJoin: { mode: "denied", reason: "нельзя вмешаться в квестовый бой" },
      canLeave: false,
      canAggro: false,
      skipQuestKills: botCount > 1,
      allowsSideBots: true,
      shufflesAfterHits: false,
      pairsNextWaiter: true,
      awardsHonor: false,
      restoresFighters: false,
      includesQuestChat: true,
      ...enemyBotsHistory(true),
    });
  }

  static forFriendlyDuel(): FightRules {
    return FightRules.create({
      version: FIGHT_RULES_VERSION,
      teamAssignment: { openerTeam: 1, enemyTeam: 2 },
      humanJoin: { mode: "denied", reason: "нельзя вмешаться в дуэль" },
      canLeave: true,
      canAggro: false,
      skipQuestKills: false,
      allowsSideBots: false,
      shufflesAfterHits: false,
      pairsNextWaiter: false,
      awardsHonor: false,
      restoresFighters: true,
      includesQuestChat: false,
      ...enemyBotsHistory(false, "practice-humans"),
    });
  }

  static forPvp(): FightRules {
    return FightRules.create({
      version: FIGHT_RULES_VERSION,
      teamAssignment: { openerTeam: 1, enemyTeam: 2 },
      humanJoin: { mode: "pvp-humans" },
      canLeave: true,
      canAggro: false,
      skipQuestKills: false,
      allowsSideBots: false,
      shufflesAfterHits: false,
      pairsNextWaiter: false,
      awardsHonor: true,
      restoresFighters: false,
      includesQuestChat: false,
      ...enemyBotsHistory(false, "none"),
    });
  }
}

function enemyBotsHistory(hasEnemyBots: true): {
  readonly hasEnemyBots: true;
  readonly historyRow: "hunt-bot";
};
function enemyBotsHistory(
  hasEnemyBots: false,
  humans: "practice-humans" | "none",
): { readonly hasEnemyBots: false; readonly historyRow: "practice-humans" | "none" };
function enemyBotsHistory(
  hasEnemyBots: boolean,
  humans?: "practice-humans" | "none",
): { readonly hasEnemyBots: boolean; readonly historyRow: FightHistoryRow } {
  if (hasEnemyBots) return { hasEnemyBots: true, historyRow: "hunt-bot" };
  if (humans !== "practice-humans" && humans !== "none") {
    throw new Error("FightRules historyRow without enemy bots must be practice-humans or none");
  }
  return { hasEnemyBots: false, historyRow: humans };
}

function assertFightRules(fields: FightRulesFields): void {
  if (fields.version !== FIGHT_RULES_VERSION) {
    throw new Error(`Unknown FightRules version: ${String(fields.version)}`);
  }
  const opener = fields.teamAssignment?.openerTeam;
  const enemy = fields.teamAssignment?.enemyTeam;
  if ((opener !== 1 && opener !== 2) || (enemy !== 1 && enemy !== 2)) {
    throw new Error("FightRules teamAssignment teams must be 1 or 2");
  }
  if (opener === enemy) {
    throw new Error("FightRules teamAssignment opener and enemy must differ");
  }
  const join = fields.humanJoin;
  if (
    !join ||
    (join.mode !== "denied" && join.mode !== "hunt-roster" && join.mode !== "pvp-humans")
  ) {
    throw new Error("FightRules humanJoin mode is unknown");
  }
  if (join.mode === "denied" && !join.reason) {
    throw new Error("Denied humanJoin requires a reason");
  }
  requireFlag(fields.canLeave, "canLeave");
  requireFlag(fields.canAggro, "canAggro");
  requireFlag(fields.skipQuestKills, "skipQuestKills");
  requireFlag(fields.allowsSideBots, "allowsSideBots");
  requireFlag(fields.shufflesAfterHits, "shufflesAfterHits");
  requireFlag(fields.pairsNextWaiter, "pairsNextWaiter");
  requireFlag(fields.hasEnemyBots, "hasEnemyBots");
  requireFlag(fields.awardsHonor, "awardsHonor");
  requireFlag(fields.restoresFighters, "restoresFighters");
  requireFlag(fields.includesQuestChat, "includesQuestChat");
  if (
    fields.historyRow !== "hunt-bot" &&
    fields.historyRow !== "practice-humans" &&
    fields.historyRow !== "none"
  ) {
    throw new Error(`Unknown FightRules historyRow: ${String(fields.historyRow)}`);
  }
  if (fields.hasEnemyBots !== (fields.historyRow === "hunt-bot")) {
    throw new Error("FightRules historyRow hunt-bot must match hasEnemyBots");
  }
}

function requireFlag(value: unknown, name: string): void {
  if (typeof value !== "boolean") {
    throw new Error(`FightRules ${name} is required`);
  }
}
