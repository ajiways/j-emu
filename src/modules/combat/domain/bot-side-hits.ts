import type { BattleEvent } from "./battle-event.ts";
import type { BotSideHit } from "./bot-side-hit.ts";
import type { BotFighter } from "./bot-fighter.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { FightRules } from "./fight-rules.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { Participant } from "./participant.ts";
import { persChangeForParticipants } from "./melee-pers-change.ts";
import { settleFallen, type Fallout } from "./settle-fallen.ts";

/** What the others an AOE spell of a bot reached mean for the rest of the fight. */
export type SideHitsOutcome = Readonly<{
  /** Fresh hp of everyone involved, for the stream of the aimed foe. */
  patch: Extract<BattleEvent, { type: "pers-change" }> | null;
  fallout: Fallout;
}>;

const NO_FALLOUT: Fallout = {
  deliveries: [],
  finished: null,
  fallenAccountIds: [],
  reassignedAccountIds: [],
};

/**
 * The hits of an AOE spell on fighters other than the aimed one: each human hit gets the damage
 * on his own stream, and whoever fell is settled like a fighter that fell to a tick.
 */
export function settleBotSideHits(
  input: Readonly<{
    sideHits: readonly BotSideHit[];
    bot: BotFighter;
    aimed: Participant;
    humans: readonly HumanFighter[];
    bots: readonly BotFighter[];
    duels: FightDuel[];
    fightRules: FightRules;
    fightId: string;
  }>,
): SideHitsOutcome {
  if (input.sideHits.length === 0) return { patch: null, fallout: NO_FALLOUT };
  const patch = persChangeForParticipants(
    input.humans,
    input.bots.map((bot) => bot.snap()),
    [input.bot.fightId, input.aimed.id, ...input.sideHits.map((hit) => hit.targetId)],
  );
  const hitDeliveries = input.sideHits.flatMap((hit) => {
    const human = input.humans.find((entry) => entry.heroId === hit.targetId);
    return human?.authed ? [{ accountId: human.accountId, events: [hit.event, patch] }] : [];
  });
  const fallenIds = new Set(input.sideHits.filter((hit) => hit.killed).map((hit) => hit.targetId));
  const fallen = [...input.humans, ...input.bots].filter((fighter) => fallenIds.has(fighter.id));
  const settled = settleFallen(fallen, input);
  return {
    patch,
    fallout: { ...settled, deliveries: [...hitDeliveries, ...settled.deliveries] },
  };
}
