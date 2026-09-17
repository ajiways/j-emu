import type { MailItemSnapshot } from "../modules/inventory/domain/mail-item-snapshot.ts";
import type { TradeItemSnapshot } from "../modules/trade/domain/trade-session.ts";

export function tradeSnapshotFromMail(snap: MailItemSnapshot): TradeItemSnapshot {
  return {
    originalItemId: snap.originalItemId,
    artifactId: snap.artifactId,
    quantity: snap.quantity,
    durability: snap.durability,
    durabilityMax: snap.durabilityMax,
    upgrade: snap.upgrade,
    data: snap.data,
  };
}

export function mailSnapshotFromTrade(snap: TradeItemSnapshot): MailItemSnapshot {
  return {
    originalItemId: snap.originalItemId,
    artifactId: snap.artifactId,
    quantity: snap.quantity,
    durability: snap.durability,
    durabilityMax: snap.durabilityMax,
    upgrade: snap.upgrade,
    data: snap.data,
  };
}
