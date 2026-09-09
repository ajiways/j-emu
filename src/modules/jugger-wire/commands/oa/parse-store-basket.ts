import type { StoreBasketLine } from "../../../../app/store-purchase.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export function parseStoreBasket(envelope: ObjectActionEnvelope): readonly StoreBasketLine[] {
  const form = envelope.form;
  if (!form) return [];
  if (!("basket" in form)) return [];
  const basket = form.basket;
  if (basket === undefined) return [];
  if (!basket || typeof basket !== "object" || Array.isArray(basket)) {
    throw new ProtocolError(204, "store|buy basket must be an object");
  }
  const lines: StoreBasketLine[] = [];
  for (const [key, raw] of Object.entries(basket)) {
    if (!key) throw new ProtocolError(204, "store|buy basket key is required");
    const count = Number(raw);
    if (!Number.isFinite(count) || count <= 0) continue;
    if (!Number.isInteger(count)) {
      throw new ProtocolError(204, `store|buy basket count for ${key} is invalid`);
    }
    lines.push({ key, count });
  }
  return lines;
}
