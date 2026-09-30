import type { BattleEvent } from "./battle-event.ts";
import { settleAfterMobFell } from "./battle-runtime.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { FightRules } from "./fight-rules.ts";
import type { Fighter } from "./fighter.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { BotFighter } from "./bot-fighter.ts";
import { enemySideCleared } from "./melee-target.ts";
import { opposingTeam } from "./opposing-team.ts";
import { dissolveDuelContaining } from "./pairing.ts";

export type FalloutDelivery = Readonly<{ accountId: number; events: readonly BattleEvent[] }>;

export type Fallout = Readonly<{
  deliveries: readonly FalloutDelivery[];
  finished: Extract<BattleEvent, { type: "finished" }> | null;
  /** Humans that fell while the fight goes on: their place passes to a waiter. */
  fallenAccountIds: readonly number[];
  /** Humans whose foe fell and who were given the next one. */
  reassignedAccountIds: readonly number[];
}>;

/**
 * Fighters that fell outside a swing of the acting human (a tick, a spell that hit several):
 * the fight ends if a whole side is down, else a fallen human's place goes to a waiter and the
 * hunter of a fallen bot gets the next foe.
 */
export function settleFallen(
  fallen: readonly Fighter[],
  input: Readonly<{
    humans: readonly HumanFighter[];
    bots: readonly BotFighter[];
    duels: FightDuel[];
    fightRules: FightRules;
    fightId: string;
  }>,
): Fallout {
  const combatants = [...input.humans, ...input.bots];
  const lost = fallen.find((fighter) => enemySideCleared(fighter.team, combatants));
  if (lost) {
    const finished = {
      type: "finished" as const,
      winnerTeam: opposingTeam(lost.team),
      fightId: input.fightId,
    };
    return { deliveries: [], finished, fallenAccountIds: [], reassignedAccountIds: [] };
  }
  const fallenAccountIds: number[] = [];
  const reassigned: FalloutDelivery[] = [];
  for (const fighter of fallen) {
    if (fighter.fighterKind === "human") {
      fallenAccountIds.push(humanOf(input.humans, fighter.id).accountId);
      continue;
    }
    const hunter = pairedHuman(input, fighter.id);
    if (!hunter) {
      dissolveDuelContaining(input.duels, [...input.humans, ...input.bots], fighter.id);
      continue;
    }
    const duel = input.duels.find((entry) => entry.has(fighter.id));
    if (!duel) continue;
    const next = settleAfterMobFell(false, {
      bots: input.bots,
      enemyTeam: input.fightRules.teamAssignment.enemyTeam,
      duel,
      duels: input.duels,
      opener: hunter,
      humans: input.humans,
    });
    if (hunter.authed) reassigned.push({ accountId: hunter.accountId, events: next.events });
  }
  return {
    deliveries: reassigned,
    finished: null,
    fallenAccountIds,
    reassignedAccountIds: reassigned.map((entry) => entry.accountId),
  };
}

function pairedHuman(
  input: Readonly<{ humans: readonly HumanFighter[]; duels: FightDuel[] }>,
  botId: number,
): HumanFighter | undefined {
  const duel = input.duels.find((entry) => entry.has(botId));
  if (!duel) return undefined;
  const otherId = duel.otherId(botId);
  return input.humans.find((human) => human.heroId === otherId);
}

function humanOf(humans: readonly HumanFighter[], id: number): HumanFighter {
  const human = humans.find((entry) => entry.heroId === id);
  if (!human) throw new Error(`Fight human ${id} is missing`);
  return human;
}
