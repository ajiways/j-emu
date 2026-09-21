import { practiceRestoreFrom } from "./battle-fighters.ts";
import type { FightRules } from "./fight-rules.ts";
import {
  fightSetupTeamHumans,
  requireFightSetupPrimaryEnemy,
  type FightSetup,
} from "./fight-setup.ts";
import type { HuntHuman } from "./hunt-human.ts";
import type { FightOutcomeKind, FightOutcomeSnapshot } from "./fight-outcome-snapshot.ts";

export function leaveWinnerTeam(humans: readonly HuntHuman[]): 1 | 2 {
  const remaining = humans.filter((human) => !human.leftLive);
  const last = remaining[remaining.length - 1];
  if (!last) throw new Error("Leave requires a human in the battle");
  return last.hp <= 0 ? 2 : 1;
}

export function battleOutcomeSnapshot(
  input: Readonly<{
    setup: FightSetup;
    fightId: string;
    kind: FightOutcomeKind;
    winnerTeam: 1 | 2;
    humans: readonly HuntHuman[];
    fightRules: FightRules;
  }>,
): FightOutcomeSnapshot {
  const humans = input.humans.map((human) => ({
    accountId: human.accountId,
    characterId: human.heroId,
    team: human.team,
    level: human.level,
    hp: human.hp,
    maxHp: human.maxHp,
    damageToBot: human.damageToBot,
    damageToHumans: human.damageToHumans,
    leftLive: human.leftLive,
    pocket: human.pocketCells(),
  }));
  if (input.fightRules.awardsHonor) {
    return {
      mode: "pvp",
      fightId: input.fightId,
      winnerTeam: input.winnerTeam,
      kind: input.kind,
      humans,
    };
  }
  if (input.fightRules.restoresFighters) {
    const opener = fightSetupTeamHumans(input.setup, input.fightRules.teamAssignment.openerTeam)[0];
    const enemy = fightSetupTeamHumans(input.setup, input.fightRules.teamAssignment.enemyTeam)[0];
    if (!opener || !enemy) throw new Error("Practice restore requires both duel fighters");
    return {
      mode: "friendly-practice",
      fightId: input.fightId,
      winnerTeam: input.winnerTeam,
      kind: input.kind,
      humans,
      restore: [practiceRestoreFrom(opener), practiceRestoreFrom(enemy)],
    };
  }
  if (!input.fightRules.hasEnemyBots) {
    throw new Error("Hunt outcome requires a hunt fight setup");
  }
  const primary = requireFightSetupPrimaryEnemy(
    input.setup,
    input.fightRules.teamAssignment.enemyTeam,
  );
  return {
    mode: "hunt",
    fightId: input.fightId,
    botId: primary.artikulId,
    botLevel: primary.level,
    winnerTeam: input.winnerTeam,
    kind: input.kind,
    humans,
  };
}
