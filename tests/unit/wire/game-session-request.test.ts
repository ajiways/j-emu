import { describe, expect, it } from "vitest";
import { parseGameSessionRequest } from "../../../src/modules/jugger-wire/infrastructure/http/game-session-request.ts";

describe("parseGameSessionRequest", () => {
  it("reads a complete handoff query without treating cookies as the session", () => {
    expect(
      parseGameSessionRequest(
        { _s: "sess-1", _k: "key-1", _u: "12" },
        { PHPSESSID: "cookie-session" },
      ),
    ).toEqual({ kind: "handoff", sessionId: "sess-1" });
  });

  it("uses the PHPSESSID cookie when the query has no handoff fields", () => {
    expect(parseGameSessionRequest({}, { PHPSESSID: "cookie-session" })).toEqual({
      kind: "cookie",
      sessionId: "cookie-session",
    });
  });

  it("treats a partial handoff query as missing instead of inventing fields", () => {
    expect(parseGameSessionRequest({ _s: "sess-1" }, { PHPSESSID: "cookie-session" })).toEqual({
      kind: "missing",
    });
  });

  it("rejects a non-object query instead of casting Fastify unknown", () => {
    expect(() => parseGameSessionRequest("slot=1", { PHPSESSID: "cookie-session" })).toThrow(
      /query must be a key\/value object/,
    );
  });

  it("rejects a non-object cookie bag instead of reading PHPSESSID from a fallback", () => {
    expect(() => parseGameSessionRequest({}, "PHPSESSID=cookie-session")).toThrow(
      /cookies must be a key\/value object/,
    );
  });
});
