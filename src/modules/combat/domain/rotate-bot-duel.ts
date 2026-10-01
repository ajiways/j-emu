import type { FightDuel } from "./fight-duel.ts";
import type { BotFighter } from "./bot-fighter.ts";
import type { Participant } from "./participant.ts";
import type { Roster } from "./roster.ts";
import { PAIR_HITS_TO_SWITCH } from "./try-shuffle-after-hits.ts";

/**
 * The turn-over of a duel of two mobs, as a player's duel has it: once both sides have struck
 * three times, a waiting ally of the mob that just acted (a player or another mob) takes its
 * place against the foe, and the mob steps out to wait. Returns who came in, or `null`.
 */
export function rotateBotDuel(
  input: Readonly<{
    bot: BotFighter;
    foe: Participant;
    duel: FightDuel;
    roster: Roster;
  }>,
): Participant | null {
  const { bot, foe, duel } = input;
  if (foe.fighterKind !== "bot" || !foe.alive || !bot.alive) return null;
  if (duel.hitsA < PAIR_HITS_TO_SWITCH || duel.hitsB < PAIR_HITS_TO_SWITCH) return null;
  const waiter = input.roster
    .all()
    .find(
      (entry) => entry.team === bot.team && entry.waiting && entry.alive && entry.id !== bot.id,
    );
  if (!waiter) return null;
  const hp = [bot.hp, foe.hp, waiter.hp];
  bot.unpair();
  waiter.pair();
  duel.replace(bot.id, waiter.id);
  duel.resetHits();
  duel.setNextActor(waiter.id);
  if (bot.hp !== hp[0] || foe.hp !== hp[1] || waiter.hp !== hp[2]) {
    throw new Error("Rotation must not change participant HP");
  }
  return waiter;
}
