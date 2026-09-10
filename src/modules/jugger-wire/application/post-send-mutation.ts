import type { UserBagBlock } from "./user-bag-block.ts";
import type { HeroStateBlock } from "./hero-state-block.ts";

export function postSendMutation(
  oa: "post|send" | "post|send_cod",
  bag: UserBagBlock,
  state: HeroStateBlock,
): Readonly<Record<string, unknown>> {
  return {
    [oa]: { status: 100 },
    "user|bag": bag,
    state,
  };
}
