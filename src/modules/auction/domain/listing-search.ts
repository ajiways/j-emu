export type ListingOrder = "title" | "time" | "bid" | "buyout";

export type ListingSearch = Readonly<{
  title: string;
  levelMin: number;
  levelMax: number;
  countMin: number;
  countMax: number;
  kindIds: readonly number[];
  quality: number;
  ownerKinds: readonly number[];
  order: ListingOrder;
  reverse: boolean;
  offset: number;
}>;
