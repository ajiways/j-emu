import type { FightDuel } from "./fight-duel.ts";
import type { HuntHuman } from "./hunt-human.ts";

export function retargetDuelTo(
  input: Readonly<{
    duel: FightDuel;
    fromHeroId: number;
    waiter: HuntHuman;
  }>,
): void {
  input.waiter.pair();
  input.duel.replace(input.fromHeroId, input.waiter.heroId);
  input.duel.resetHits();
  input.duel.setNextActor(input.waiter.heroId);
}
