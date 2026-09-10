import type { UserBagBlock } from "./user-bag-block.ts";
import type { HeroStateBlock } from "./hero-state-block.ts";

export function postSendMutation(
  bag: UserBagBlock,
  state: HeroStateBlock,
): Readonly<Record<string, unknown>> {
  return {
    "post|send": { status: 100 },
    "user|bag": bag,
    state,
  };
}
