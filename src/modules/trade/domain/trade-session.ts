import type { ItemInstanceData } from "../../inventory/domain/item-instance-data.ts";

export type TradeItemSnapshot = Readonly<{
  originalItemId: number;
  artifactId: number;
  quantity: number;
  durability: number;
  durabilityMax: number;
  upgrade: Readonly<{ id: number; level: number; skillId: string; bound: boolean }>;
  data: ItemInstanceData;
}>;

export type TradeTray = {
  readonly id: number;
  readonly heroId: number;
  readonly accountId: number;
  readonly nick: string;
  readonly kind: number;
  readonly level: number;
  confirmed: 0 | 1 | 2;
  moneyGold: number;
  readonly artifacts: Map<number, TradeItemSnapshot>;
};

export type TradeSession = {
  confirmKey: string;
  readonly initiatorHeroId: number;
  inviteeHeroId: number | null;
  readonly pendingInviteeHeroId: number;
  readonly pendingInviteeAccountId: number;
  readonly trays: Map<number, TradeTray>;
};
