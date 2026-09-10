import type { ListingAttachment } from "./listing-attachment.ts";
import type { ListingKind } from "./listing-kind.ts";
import type { ListingStatus } from "./listing-status.ts";

export type Listing = Readonly<{
  id: number;
  kind: ListingKind;
  status: ListingStatus;
  ownerHeroId: number;
  ownerKind: number;
  artikulId: number;
  title: string;
  kindId: number;
  quality: number;
  levelMin: number;
  amount: number;
  startPriceMinor: number;
  buyoutMinor: number;
  currentBidMinor: number;
  bidderHeroId: number | null;
  cancelFeeMinor: number;
  expiresAt: Date;
  createdAt: Date;
  attachment: ListingAttachment;
}>;

export type NewListing = Omit<Listing, "id">;
