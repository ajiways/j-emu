import type { UserBagBlock } from "./user-bag-block.ts";
import type { HeroStateBlock } from "./hero-state-block.ts";

export function userBagOrderMutation(
  bag: UserBagBlock,
  state: HeroStateBlock,
): Readonly<Record<string, unknown>> {
  return {
    "user|bag_order": { status: 100 },
    "user|bag": bag,
    state,
  };
}
