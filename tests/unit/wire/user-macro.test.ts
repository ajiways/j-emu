import { describe, expect, it } from "vitest";
import {
  buildUserMacro,
  SYSTEM_MAIL_PEER,
} from "../../../src/modules/jugger-wire/application/user-macro.ts";

describe("buildUserMacro", () => {
  it("emits [[USER key]] without clan fields or id", () => {
    const token = buildUserMacro({ nick: "Ada", level: 3, kind: 2 });
    expect(token.token).toMatch(/^\[\[USER [0-9a-f]{32}\]\]$/);
    expect(token.macro).toEqual({
      nick: "Ada",
      macro_text: "Ada",
      level: 3,
      kind: 2,
      rank: 0,
      server_id: 1,
      key_id: token.key,
      macro_type: "USER",
    });
    expect(token.macro).not.toHaveProperty("id");
    expect(token.macro).not.toHaveProperty("clan_id");
  });

  it("uses named system peer for the postman", () => {
    expect(SYSTEM_MAIL_PEER).toEqual({ nick: "Почтальон", level: 0, kind: 0 });
  });
});
