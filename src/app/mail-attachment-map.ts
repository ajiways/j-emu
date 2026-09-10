import type { LetterAttachment } from "../modules/mail/domain/letter-attachment.ts";
import type { MailItemSnapshot } from "../modules/inventory/domain/mail-item-snapshot.ts";

export function letterAttachmentFromSnapshot(snap: MailItemSnapshot): LetterAttachment {
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
  };
}

export function mailSnapshotFromAttachment(attachment: LetterAttachment): MailItemSnapshot {
  return {
    originalItemId: attachment.originalItemId,
    artifactId: attachment.artifactId,
    quantity: attachment.quantity,
    durability: attachment.durability,
    durabilityMax: attachment.durabilityMax,
    upgrade: {
      id: attachment.upgradeId,
      level: attachment.upgradeLevel,
      skillId: attachment.upgradeSkillId,
      bound: attachment.upgradeBound === 1,
    },
  };
}
