import type { StorePay } from "./store-pay.ts";
import type { StoreRequires } from "./store-requires.ts";

export type StoreType = Readonly<{
  areaId: string;
  typeId: number;
  title: string;
  ord: number;
}>;

export type StoreLot = Readonly<{
  areaId: string;
  lotId: number;
  artikulId: number;
  typeId: number;
  price: number;
  ord: number;
  pay: StorePay;
  requires: StoreRequires | null;
}>;
