import { parseDecimalId, requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { BattleRules } from "./battle-rules.ts";
import type { FightRules } from "./fight-rules.ts";
import {
  fightSetupAis,
  fightSetupHumans,
  fightSetupTeamAis,
  isFightSetupHuman,
  type FightSetup,
  type FightSetupAi,
  type FightSetupHuman,
  type FightSetupJoin,
} from "./fight-setup.ts";
import { requireFightSetupParticipant } from "./require-fight-setup-participant.ts";

export function requireFightSetup(
  setup: FightSetup,
  rules: BattleRules,
  fightRules: FightRules,
): void {
  requireMeta(setup);
  requireBattleRules(rules);
  const team1 = setup.teams[1];
  const team2 = setup.teams[2];
  if (!Array.isArray(team1) || !Array.isArray(team2)) {
    throw new Error("Fight setup teams 1 and 2 are required");
  }
  for (const participant of [...team1, ...team2]) {
    requireFightSetupParticipant(participant);
  }
  const humans = fightSetupHumans(setup);
  const ais = fightSetupAis(setup);
  requireParticipantIds(humans, ais);
  requireKindComposition(setup, fightRules, humans, ais);
}

export function requireFightSetupJoin(join: FightSetupJoin): void {
  requireFightSetupParticipant(join);
  if (join.team !== 1 && join.team !== 2) throw new Error("Hunt human team must be 1 or 2");
  if (!Number.isInteger(join.startedAtMs) || join.startedAtMs < 0) {
    throw new Error("Fight join clock must be a non-negative integer");
  }
}

function requireMeta(setup: FightSetup): void {
  const { meta } = setup;
  if (
    meta.kind !== "hunt" &&
    meta.kind !== "quest" &&
    meta.kind !== "friendly-duel" &&
    meta.kind !== "pvp"
  ) {
    throw new Error(`Unknown fight kind: ${String(meta.kind)}`);
  }
  requireWireIdentity(Number(parseDecimalId(meta.fightId, "fight id")), "fight id");
  if (!meta.accessKey) throw new Error("Fight access key is required");
  if (!meta.arena) throw new Error("Fight arena is required");
  if (!meta.areaId) throw new Error("Battle area is required");
  if (!(meta.startedAt instanceof Date) || Number.isNaN(meta.startedAt.getTime())) {
    throw new Error("Fight startedAt is required");
  }
  if (typeof meta.chatWin !== "string") throw new Error("Quest fight chatWin is required");
  if (typeof meta.chatLose !== "string") throw new Error("Quest fight chatLose is required");
  if (meta.kind === "pvp") {
    if (meta.instanceCopyId === null) throw new Error("PvP fight copy is required");
    requireWireIdentity(meta.instanceCopyId, "pvp instance copy id");
    if (!meta.fightFlags) throw new Error("PvP fight flags are required");
  } else if (meta.kind === "friendly-duel") {
    if (meta.instanceCopyId !== null) throw new Error("Friendly duel must be in the world");
    if (meta.fightFlags !== null) throw new Error("Friendly duel must not carry PvP flags");
  } else if (meta.instanceCopyId !== null) {
    requireWireIdentity(meta.instanceCopyId, "instance copy id");
  }
  if (meta.kind !== "pvp" && meta.kind !== "friendly-duel" && meta.fightFlags !== null) {
    throw new Error("Hunt fight must not carry PvP flags");
  }
}

function requireKindComposition(
  setup: FightSetup,
  fightRules: FightRules,
  humans: readonly FightSetupHuman[],
  ais: readonly FightSetupAi[],
): void {
  const { openerTeam, enemyTeam } = fightRules.teamAssignment;
  const sideBots =
    fightSetupTeamAis(setup, openerTeam).length > 0 ||
    fightSetupTeamAis(setup, enemyTeam).length > 1;
  if (!fightRules.allowsSideBots && fightRules.hasEnemyBots && sideBots) {
    throw new Error("Hunt fights cannot include a quest roster");
  }
  if (!fightRules.allowsSideBots && !fightRules.hasEnemyBots && ais.length > 0) {
    throw new Error("Human duel cannot include bots");
  }
  if (fightRules.hasEnemyBots) {
    if (humans.length < 1) throw new Error("Hunt fight requires a human participant");
    const primary = fightSetupTeamAis(setup, enemyTeam)[0];
    if (!primary) throw new Error("Fight setup is missing the primary enemy bot");
  } else {
    if (humans.length !== 2) throw new Error("Human duel requires two human participants");
    const left = humans[0];
    const right = humans[1];
    if (!left || !right) throw new Error("Human duel requires two human participants");
    if (left.accountId === right.accountId) {
      throw new Error("Friendly duel accounts must be distinct");
    }
    if (left.heroId === right.heroId) {
      throw new Error("Friendly duel heroes must be distinct");
    }
    if (setup.teams[openerTeam].filter(isFightSetupHuman).length !== 1) {
      throw new Error("Human duel opener team must have one human");
    }
    if (setup.teams[enemyTeam].filter(isFightSetupHuman).length !== 1) {
      throw new Error("Human duel enemy team must have one human");
    }
  }
}

function requireParticipantIds(
  humans: readonly FightSetupHuman[],
  ais: readonly FightSetupAi[],
): void {
  const seen = new Set<number>();
  for (const human of humans) {
    if (seen.has(human.heroId)) {
      throw new Error(`Fight participant id ${human.heroId} collides`);
    }
    seen.add(human.heroId);
  }
  for (const ai of ais) {
    if (seen.has(ai.fightId)) {
      const hitsHuman = humans.some((human) => human.heroId === ai.fightId);
      throw new Error(
        hitsHuman
          ? "Fight bot id collides with the human participant id"
          : `Roster bot fight id ${ai.fightId} collides`,
      );
    }
    seen.add(ai.fightId);
  }
}

function requireBattleRules(rules: BattleRules): void {
  if (rules.strPerDamagePoint < 1) throw new Error("strPerDamagePoint must be positive");
  if (
    typeof rules.damageSpread !== "number" ||
    Number.isNaN(rules.damageSpread) ||
    rules.damageSpread <= 0 ||
    rules.damageSpread >= 1
  ) {
    throw new Error("damageSpread must be in (0, 1)");
  }
  if (rules.turnTimeoutSeconds < 1) throw new Error("Turn timeout must be positive");
  if (!Number.isInteger(rules.meleeBotCounterMs) || rules.meleeBotCounterMs < 1) {
    throw new Error("Melee bot-counter delay must be positive");
  }
  if (!Number.isInteger(rules.turnGrantDelayMs) || rules.turnGrantDelayMs < 1) {
    throw new Error("Turn grant delay must be positive");
  }
  if (rules.turnGrantDelayMs < rules.meleeBotCounterMs) {
    throw new Error("Turn grant delay must be at least the melee bot-counter delay");
  }
}
