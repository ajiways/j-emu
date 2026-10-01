import { FightDuel } from "./fight-duel.ts";
import type { BattleRules } from "./battle-rules.ts";
import { seedHuman } from "./battle-fighters.ts";
import { FightEffectIds } from "./fight-effect-ids.ts";
import type { FightRules } from "./fight-rules.ts";
import { seedFightBots } from "./fight-bots.ts";
import {
  aiRosterSeed,
  fightSetupTeamAis,
  fightSetupTeamHumans,
  type FightSetup,
} from "./fight-setup.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { pairLeftoverRosterBots } from "./pair-leftover-roster-bots.ts";
import type { Participant } from "./participant.ts";
import type { RandomSource } from "./random-source.ts";
import { requireFightSetup } from "./require-fight-setup.ts";
import { rollOpensFirst } from "./roll-opens-first.ts";

export type BattleSeed = Readonly<{
  bots: readonly BotFighter[];
  pairedAccountId: number;
  humans: readonly HumanFighter[];
  duels: readonly FightDuel[];
}>;

export function seedBattleParticipants(
  setup: FightSetup,
  rules: BattleRules,
  fightRules: FightRules,
  random: RandomSource,
): BattleSeed {
  requireFightSetup(setup, rules, fightRules);
  const effectIds = new FightEffectIds();
  const startedAtMs = setup.meta.startedAt.getTime();
  const { openerTeam, enemyTeam } = fightRules.teamAssignment;
  const humans = [
    ...fightSetupTeamHumans(setup, openerTeam).map((human) =>
      seedHuman(human, openerTeam, fightRules.openerWaits, startedAtMs, effectIds),
    ),
    ...fightSetupTeamHumans(setup, enemyTeam).map((human) =>
      seedHuman(human, enemyTeam, false, startedAtMs, effectIds),
    ),
  ];
  if (fightSetupTeamAis(setup, enemyTeam).length === 0) {
    const opener = requireTeamHuman(setup, openerTeam, "Human duel opener");
    const enemy = requireTeamHuman(setup, enemyTeam, "Human duel acceptor");
    return {
      bots: [],
      pairedAccountId: opener.accountId,
      humans,
      duels: [
        rolledOpening(new FightDuel(opener.heroId, enemy.heroId, opener.heroId), {
          members: humans,
          enemyTeam,
          random,
        }),
      ],
    };
  }
  const enemyAis = fightSetupTeamAis(setup, enemyTeam);
  const primary = enemyAis[0];
  if (!primary) throw new Error("Fight setup is missing the primary enemy bot");
  const opener = requireTeamHuman(setup, openerTeam, "Hunt opener");
  const bots = seedFightBots({
    enemyAis: enemyAis.map(aiRosterSeed),
    openerAis: fightSetupTeamAis(setup, openerTeam).map(aiRosterSeed),
    occupiedIds: humans.map((human) => human.heroId),
    effectIds,
    enemyTeam,
    openerTeam,
    primaryWaits: fightRules.openerWaits,
  });
  return {
    bots,
    pairedAccountId: opener.accountId,
    humans,
    duels: [
      ...(fightRules.openerWaits
        ? []
        : [
            rolledOpening(new FightDuel(opener.heroId, primary.fightId, opener.heroId), {
              members: [...humans, ...bots],
              enemyTeam,
              random,
            }),
          ]),
      ...pairLeftoverRosterBots(bots, fightRules.teamAssignment),
    ],
  };
}

function requireTeamHuman(setup: FightSetup, team: 1 | 2, label: string) {
  const human = fightSetupTeamHumans(setup, team)[0];
  if (!human) throw new Error(`${label} is missing`);
  return human;
}

/**
 * The first strike of a duel that opens the fight is rolled on the initiative of both sides, as
 * every later pair is. The enemy is the first side of the roll, so an even roll goes to the opener.
 */
function rolledOpening(
  duel: FightDuel,
  input: Readonly<{ members: readonly Participant[]; enemyTeam: 1 | 2; random: RandomSource }>,
): FightDuel {
  const sides = [duel.aId, duel.bId].map((id) => {
    const member = input.members.find((entry) => entry.id === id);
    if (!member) throw new Error(`Opening duel side ${id} is not in the fight`);
    return member;
  });
  const enemy = sides.find((side) => side.team === input.enemyTeam);
  const opener = sides.find((side) => side.team !== input.enemyTeam);
  if (!enemy || !opener) throw new Error("The opening duel needs one side of each team");
  const enemyFirst = rollOpensFirst(
    enemy.currentInitiative,
    opener.currentInitiative,
    input.random,
  );
  duel.setNextActor(enemyFirst ? enemy.id : opener.id);
  return duel;
}
