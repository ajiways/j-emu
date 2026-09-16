import type { BagItemBlock } from "./bag-item-block.ts";

export type UserBagDiffBlock = Readonly<{
  status: 100;
  changed?: Readonly<Record<string, BagItemBlock>>;
  removed?: readonly string[];
}>;

export function bagDiffChanged(
  item: BagItemBlock,
): Readonly<{ "user|bag_diff": UserBagDiffBlock }> {
  return {
    "user|bag_diff": {
      status: 100,
      changed: { [String(item.id)]: item },
    },
  };
}
