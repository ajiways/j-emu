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

type FightWireType = "1" | "6";

type FightRulesFields = Readonly<{
  version: typeof FIGHT_RULES_VERSION;
  teamAssignment: FightTeamAssignment;
  humanJoin: HumanJoinMode;
  canLeave: boolean;
  canAggro: boolean;
  skipQuestKills: boolean;
  allowsSideBots: boolean;
  shufflesAfterHits: boolean;
  pairsNextWaiter: boolean;
  hasBotTurns: boolean;
  awardsHonor: boolean;
  restoresFighters: boolean;
  wireFightType: FightWireType;
  historyRow: FightHistoryRow;
  resultTitleFromBot: boolean;
  includesQuestChat: boolean;
  includesBotIdInNotice: boolean;
}>;

type FightRulesContext =
  | Readonly<{ kind: "hunt"; instanceCopyId: number | null }>
  | Readonly<{ kind: "quest"; botCount: number }>
  | Readonly<{ kind: "friendly-duel" }>
  | Readonly<{ kind: "pvp" }>;

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
  readonly hasBotTurns!: boolean;
  readonly awardsHonor!: boolean;
  readonly restoresFighters!: boolean;
  readonly wireFightType!: FightWireType;
  readonly historyRow!: FightHistoryRow;
  readonly resultTitleFromBot!: boolean;
  readonly includesQuestChat!: boolean;
  readonly includesBotIdInNotice!: boolean;

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
      hasBotTurns: true,
      awardsHonor: false,
      restoresFighters: false,
      wireFightType: "1",
      historyRow: "hunt-bot",
      resultTitleFromBot: true,
      includesQuestChat: false,
      includesBotIdInNotice: true,
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
      hasBotTurns: true,
      awardsHonor: false,
      restoresFighters: false,
      wireFightType: "1",
      historyRow: "hunt-bot",
      resultTitleFromBot: true,
      includesQuestChat: true,
      includesBotIdInNotice: true,
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
      hasBotTurns: false,
      awardsHonor: false,
      restoresFighters: true,
      wireFightType: "6",
      historyRow: "practice-humans",
      resultTitleFromBot: false,
      includesQuestChat: false,
      includesBotIdInNotice: false,
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
      hasBotTurns: false,
      awardsHonor: true,
      restoresFighters: false,
      wireFightType: "1",
      historyRow: "none",
      resultTitleFromBot: false,
      includesQuestChat: false,
      includesBotIdInNotice: false,
    });
  }
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
  requireFlag(fields.hasBotTurns, "hasBotTurns");
  requireFlag(fields.awardsHonor, "awardsHonor");
  requireFlag(fields.restoresFighters, "restoresFighters");
  requireFlag(fields.resultTitleFromBot, "resultTitleFromBot");
  requireFlag(fields.includesQuestChat, "includesQuestChat");
  requireFlag(fields.includesBotIdInNotice, "includesBotIdInNotice");
  if (fields.wireFightType !== "1" && fields.wireFightType !== "6") {
    throw new Error(`Unknown FightRules wireFightType: ${String(fields.wireFightType)}`);
  }
  if (
    fields.historyRow !== "hunt-bot" &&
    fields.historyRow !== "practice-humans" &&
    fields.historyRow !== "none"
  ) {
    throw new Error(`Unknown FightRules historyRow: ${String(fields.historyRow)}`);
  }
}

function requireFlag(value: unknown, name: string): void {
  if (typeof value !== "boolean") {
    throw new Error(`FightRules ${name} is required`);
  }
}
