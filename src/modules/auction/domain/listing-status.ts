export const LISTING_STATUS_OPEN = "open";
export const LISTING_STATUS_SOLD = "sold";
export const LISTING_STATUS_CANCELLED = "cancelled";
export const LISTING_STATUS_EXPIRED = "expired";

export type ListingStatus =
  | typeof LISTING_STATUS_OPEN
  | typeof LISTING_STATUS_SOLD
  | typeof LISTING_STATUS_CANCELLED
  | typeof LISTING_STATUS_EXPIRED;
