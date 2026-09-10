import type { ItemUpgrade } from "./item-upgrade.ts";

export type MailItemSnapshot = Readonly<{
  originalItemId: number;
  artifactId: number;
  quantity: number;
  durability: number;
  durabilityMax: number;
  upgrade: ItemUpgrade;
}>;
