import type { LetterAttachment } from "../modules/mail/domain/letter-attachment.ts";
import type { ListingAttachment } from "../modules/auction/domain/listing-attachment.ts";
import type { MailItemSnapshot } from "../modules/inventory/domain/mail-item-snapshot.ts";

export function listingAttachmentFromSnapshot(snap: MailItemSnapshot): ListingAttachment {
  return {
    originalItemId: snap.originalItemId,
    artifactId: snap.artifactId,
    quantity: snap.quantity,
    durability: snap.durability,
    durabilityMax: snap.durabilityMax,
    upgradeId: snap.upgrade.id,
    upgradeLevel: snap.upgrade.level,
    upgradeSkillId: snap.upgrade.skillId,
    upgradeBound: snap.upgrade.bound ? 1 : 0,
    data: snap.data,
  };
}

export function letterAttachmentFromListing(attachment: ListingAttachment): LetterAttachment {
  return {
    originalItemId: attachment.originalItemId,
    artifactId: attachment.artifactId,
    quantity: attachment.quantity,
    durability: attachment.durability,
    durabilityMax: attachment.durabilityMax,
    upgradeId: attachment.upgradeId,
    upgradeLevel: attachment.upgradeLevel,
    upgradeSkillId: attachment.upgradeSkillId,
    upgradeBound: attachment.upgradeBound,
    data: attachment.data,
  };
}
