import { FightEffectIds } from "../../src/modules/combat/domain/fight-effect-ids.ts";
import { seedFightBots } from "../../src/modules/combat/domain/fight-bots.ts";
import type { FightTeamAssignment } from "../../src/modules/combat/domain/fight-rules.ts";
import type { HuntRosterBot } from "../../src/modules/combat/domain/hunt-roster-bot.ts";
import type { HuntRosterBotSeed } from "../../src/modules/combat/domain/hunt-roster-bot.ts";
import { EMPTY_HUNT_BOT_SPELL_BOOK, GRYZL_FIGHT_LOOK } from "./hunt-start-input.ts";

export function unitBotSeed(fightId: number, nick = `bot${fightId}`): HuntRosterBotSeed {
  return {
    fightId,
    artikulId: 2,
    nick,
    level: 1,
    hp: 20,
    strength: 20,
    initiative: 0,
    magPower: 0,
    magResist: 0,
    avatar: GRYZL_FIGHT_LOOK.botAvatar,
    sk: GRYZL_FIGHT_LOOK.botSk,
    body: GRYZL_FIGHT_LOOK.botBody,
    spellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
  };
}

export function unitFightBots(
  input: Readonly<{
    extraEnemies?: readonly HuntRosterBotSeed[];
    allies?: readonly HuntRosterBotSeed[];
    occupiedIds?: readonly number[];
    teamAssignment?: FightTeamAssignment;
    effectIds?: FightEffectIds;
    primary?: HuntRosterBotSeed;
  }> = {},
): HuntRosterBot[] {
  const teamAssignment = input.teamAssignment ?? { openerTeam: 1, enemyTeam: 2 };
  return seedFightBots({
    enemyAis: [input.primary ?? unitBotSeed(1_000_000), ...(input.extraEnemies ?? [])],
    openerAis: [...(input.allies ?? [])],
    occupiedIds: input.occupiedIds ?? [1],
    effectIds: input.effectIds ?? new FightEffectIds(),
    enemyTeam: teamAssignment.enemyTeam,
    openerTeam: teamAssignment.openerTeam,
  });
}
