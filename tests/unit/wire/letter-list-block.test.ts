import { describe, expect, it } from "vitest";
import type { Letter } from "../../../src/modules/mail/domain/letter.ts";
import {
  MAIL_FOLDER_INBOX,
  MAIL_FOLDER_OUTBOX,
} from "../../../src/modules/mail/domain/mail-folder.ts";
import { WELCOME_LETTER } from "../../../src/modules/mail/domain/welcome-letter.ts";
import { buildLetterListBlock } from "../../../src/modules/jugger-wire/application/letter-list-block.ts";
import {
  buildUserMacro,
  SYSTEM_MAIL_PEER,
} from "../../../src/modules/jugger-wire/application/user-macro.ts";

describe("letter list wire", () => {
  it("uses empty arrays when the folder has no letters", () => {
    expect(buildLetterListBlock([], MAIL_FOLDER_INBOX, new Map())).toEqual({
      status: 100,
      list: [],
      macros_list: [],
    });
  });

  it("maps id to letter and [[USER]] macros from the current peer", () => {
    const letter = sampleLetter({
      id: 9,
      peerHeroId: 2,
      peerNick: "OldNick",
      folder: MAIL_FOLDER_OUTBOX,
    });
    const peer = { nick: "Bee", level: 4, kind: 1 };
    const block = buildLetterListBlock([letter], MAIL_FOLDER_OUTBOX, new Map([[2, peer]]));
    const token = buildUserMacro(peer);
    expect(block.macros_list).toEqual({ [token.key]: token.macro });
    const list = block.list as Record<string, Record<string, unknown>>;
    expect(list["9"]).toMatchObject({
      id: 9,
      subject: letter.subject,
      text: letter.body,
      to_nick: token.token,
      money_type: "0",
      artifact_list: [],
    });
    expect(list["9"]).not.toHaveProperty("from_nick");
  });

  it("uses the system postman peer when peer_hero_id is null", () => {
    const letter = sampleLetter({
      id: 1,
      peerHeroId: null,
      peerNick: WELCOME_LETTER.fromNick,
      folder: MAIL_FOLDER_INBOX,
    });
    const block = buildLetterListBlock([letter], MAIL_FOLDER_INBOX, new Map());
    const token = buildUserMacro({ ...SYSTEM_MAIL_PEER, nick: WELCOME_LETTER.fromNick });
    const list = block.list as Record<string, Record<string, unknown>>;
    expect(list["1"]).toMatchObject({ from_nick: token.token });
  });
});

function sampleLetter(overrides: Partial<Letter>): Letter {
  return {
    id: 1,
    ownerHeroId: 1,
    folder: MAIL_FOLDER_INBOX,
    peerHeroId: null,
    peerNick: WELCOME_LETTER.fromNick,
    subject: WELCOME_LETTER.subject,
    body: WELCOME_LETTER.text,
    sentAt: new Date("2024-01-01T00:00:00Z"),
    expiresAt: new Date("2024-01-11T00:00:00Z"),
    flags: 0,
    moneyComeMinor: 0,
    paymentMinor: 0,
    taxMinor: 0,
    moneyType: 0,
    pairId: null,
    system: 1,
    ...overrides,
  };
}
