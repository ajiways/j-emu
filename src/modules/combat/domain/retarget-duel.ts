import type { FightDuel } from "./fight-duel.ts";
import type { HumanFighter } from "./human-fighter.ts";

export function retargetDuelTo(
  input: Readonly<{
    duel: FightDuel;
    fromHeroId: number;
    waiter: HumanFighter;
  }>,
): void {
  input.waiter.pair();
  input.duel.replace(input.fromHeroId, input.waiter.heroId);
  input.duel.resetHits();
  input.duel.setNextActor(input.waiter.heroId);
}
