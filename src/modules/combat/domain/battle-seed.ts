import { FightDuel } from "./fight-duel.ts";
import type { BattleRules } from "./battle-rules.ts";
import { seedHuman } from "./battle-fighters.ts";
import { FightEffectIds } from "./fight-effect-ids.ts";
import type { FightKind } from "./fight-rules.ts";
import type { FightRules } from "./fight-rules.ts";
import {
  aiRosterSeed,
  fightSetupTeamAis,
  fightSetupTeamHumans,
  type FightSetup,
} from "./fight-setup.ts";
import type { HuntHuman } from "./hunt-human.ts";
import { HuntRoster } from "./hunt-roster.ts";
import { pairLeftoverRosterBots } from "./pair-leftover-roster-bots.ts";
import { requireFightSetup } from "./require-fight-setup.ts";

export type BattleSeed = Readonly<{
  kind: "hunt" | "friendly-duel" | "pvp";
  huntRoster: HuntRoster | null;
  pairedAccountId: number;
  humans: readonly HuntHuman[];
  duels: readonly FightDuel[];
}>;

export function seedBattleParticipants(
  setup: FightSetup,
  rules: BattleRules,
  fightRules: FightRules,
): BattleSeed {
  requireFightSetup(setup, rules, fightRules);
  const effectIds = new FightEffectIds();
  const startedAtMs = setup.meta.startedAt.getTime();
  const { openerTeam, enemyTeam } = fightRules.teamAssignment;
  const humans = [
    ...fightSetupTeamHumans(setup, openerTeam).map((human) =>
      seedHuman(human, openerTeam, false, startedAtMs, effectIds),
    ),
    ...fightSetupTeamHumans(setup, enemyTeam).map((human) =>
      seedHuman(human, enemyTeam, false, startedAtMs, effectIds),
    ),
  ];
  if (!fightRules.hasEnemyBots) {
    const opener = requireTeamHuman(setup, openerTeam, "Human duel opener");
    const enemy = requireTeamHuman(setup, enemyTeam, "Human duel acceptor");
    return {
      kind: battleKindOf(setup.meta.kind),
      huntRoster: null,
      pairedAccountId: opener.accountId,
      humans,
      duels: [new FightDuel(opener.heroId, enemy.heroId, opener.heroId)],
    };
  }
  const primary = fightSetupTeamAis(setup, enemyTeam)[0];
  if (!primary) throw new Error("Fight setup is missing the primary enemy bot");
  const extraEnemies = fightSetupTeamAis(setup, enemyTeam).slice(1).map(aiRosterSeed);
  const allies = fightSetupTeamAis(setup, openerTeam).map(aiRosterSeed);
  const opener = requireTeamHuman(setup, openerTeam, "Hunt opener");
  const huntRoster = new HuntRoster({
    primary: aiRosterSeed(primary),
    extraEnemies,
    allies,
    occupiedIds: humans.map((human) => human.heroId),
    effectIds,
    teamAssignment: fightRules.teamAssignment,
  });
  return {
    kind: "hunt",
    huntRoster,
    pairedAccountId: opener.accountId,
    humans,
    duels: [
      new FightDuel(opener.heroId, primary.fightId, opener.heroId),
      ...pairLeftoverRosterBots(huntRoster),
    ],
  };
}

function requireTeamHuman(setup: FightSetup, team: 1 | 2, label: string) {
  const human = fightSetupTeamHumans(setup, team)[0];
  if (!human) throw new Error(`${label} is missing`);
  return human;
}

function battleKindOf(kind: FightKind): "hunt" | "friendly-duel" | "pvp" {
  if (kind === "quest") return "hunt";
  if (kind === "hunt" || kind === "friendly-duel" || kind === "pvp") return kind;
  throw new Error(`Unknown fight kind: ${String(kind)}`);
}
