import type { UserBagBlock } from "./user-bag-block.ts";
import type { HeroStateBlock } from "./hero-state-block.ts";

export function postDeleteMutation(
  listKey: "post|list" | "post|list_sent",
  list: object,
  bag: UserBagBlock,
  state: HeroStateBlock,
): Readonly<Record<string, unknown>> {
  return {
    "post|delete": { status: 100 },
    [listKey]: list,
    "user|bag": bag,
    state,
  };
}
