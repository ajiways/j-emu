import { describe, expect, it } from "vitest";
import { letterHasValuables } from "../../../src/modules/mail/domain/letter-valuables.ts";
import { MAIL_FOLDER_INBOX } from "../../../src/modules/mail/domain/mail-folder.ts";
import type { Letter } from "../../../src/modules/mail/domain/letter.ts";

describe("letterHasValuables", () => {
  it("treats attachments as valuables even without gold", () => {
    const letter = baseLetter();
    expect(letterHasValuables(letter)).toBe(false);
    expect(letterHasValuables({ ...letter, moneyComeMinor: 1 })).toBe(true);
    expect(
      letterHasValuables({
        ...letter,
        attachments: [
          {
            originalItemId: 100_000,
            artifactId: 23,
            quantity: 1,
            durability: 30,
            durabilityMax: 30,
            upgradeId: 0,
            upgradeLevel: 0,
            upgradeSkillId: "",
            upgradeBound: 0,
          },
        ],
      }),
    ).toBe(true);
  });
});

function baseLetter(): Letter {
  return {
    id: 1,
    ownerHeroId: 1,
    folder: MAIL_FOLDER_INBOX,
    peerHeroId: 2,
    peerNick: "Bee",
    subject: "x",
    body: "y",
    sentAt: new Date("2024-01-01T00:00:00Z"),
    expiresAt: new Date("2024-01-11T00:00:00Z"),
    flags: 0,
    moneyComeMinor: 0,
    paymentMinor: 0,
    taxMinor: 0,
    moneyType: 0,
    pairId: 1,
    system: 0,
    attachments: [],
  };
}
