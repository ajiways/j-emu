import { describe, expect, it } from "vitest";
import { ProtocolError } from "../../../src/modules/jugger-wire/application/protocol-error.ts";
import { OaAccessLog } from "../../../src/modules/jugger-wire/infrastructure/http/oa-access-log.ts";

const secretProbe = /cookie|password|PHPSESSID|sess_key|sess_uid|authorization|Set-Cookie/i;

describe("OA access log", () => {
  it("records a successful command without payload values", () => {
    const record = OaAccessLog.completed({
      accountId: 7,
      envelope: { object: "common", action: "init", sequence: 1 },
      implemented: true,
      payload: {
        "common|init": { status: 100 },
        state: { area_id: "503" },
        sq: 1,
      },
    });
    expect(record).toEqual({
      accountId: 7,
      object: "common",
      action: "init",
      commandKey: "common|init",
      sq: 1,
      outcome: "ok",
      status: 100,
      topLevelKeys: ["common|init", "sq", "state"],
    });
    expect(JSON.stringify(record)).not.toMatch(secretProbe);
    expect(record).not.toHaveProperty("state");
    expect(JSON.stringify(record)).not.toContain("503");
  });

  it("records an unsupported command as outcome unsupported", () => {
    const record = OaAccessLog.completed({
      accountId: 7,
      envelope: { object: "common", action: "conf", sequence: "3" },
      implemented: false,
      payload: {
        "common|conf": { status: 203, error: "common|conf is not implemented" },
        sq: "3",
      },
    });
    expect(record.outcome).toBe("unsupported");
    expect(record.status).toBe(203);
    expect(record.commandKey).toBe("common|conf");
    expect(JSON.stringify(record)).not.toMatch(secretProbe);
  });

  it("records decode failure without an envelope", () => {
    const record = OaAccessLog.failed({
      accountId: null,
      envelope: undefined,
      error: new Error("Unsupported AMF3 marker 0xff"),
    });
    expect(record).toEqual({
      accountId: null,
      object: null,
      action: null,
      commandKey: null,
      sq: null,
      outcome: "decode_failure",
      status: 204,
      topLevelKeys: ["common|unknown", "sq"],
      error: "Unsupported AMF3 marker 0xff",
    });
    expect(JSON.stringify(record)).not.toMatch(secretProbe);
  });

  it("records no-session as protocol_error with object and action", () => {
    const record = OaAccessLog.failed({
      accountId: null,
      envelope: { object: "common", action: "init", sequence: 1 },
      error: new ProtocolError(4, "No active session"),
    });
    expect(record.outcome).toBe("protocol_error");
    expect(record.status).toBe(4);
    expect(record.object).toBe("common");
    expect(record.action).toBe("init");
    expect(record.commandKey).toBe("common|init");
    expect(record.error).toBe("No active session");
    expect(JSON.stringify(record)).not.toMatch(secretProbe);
  });

  it("records a missing common|object form without inventing a code", () => {
    const record = OaAccessLog.failed({
      accountId: 7,
      envelope: { object: "common", action: "object", sequence: 10 },
      error: new ProtocolError(203, "common|object requires form"),
    });
    expect(record.outcome).toBe("protocol_error");
    expect(record.commandKey).toBe("common|object");
    expect(record.status).toBe(203);
  });

  it("writes info for unsupported and error for decode failure", () => {
    const lines: Array<{ level: string; obj: { oa: { outcome: string } }; msg: string }> = [];
    const log = {
      info(obj: { oa: { outcome: string } }, msg: string) {
        lines.push({ level: "info", obj, msg });
      },
      error(obj: { oa: { outcome: string } }, msg: string) {
        lines.push({ level: "error", obj, msg });
      },
    };
    OaAccessLog.write(
      log,
      OaAccessLog.completed({
        accountId: 1,
        envelope: { object: "clan", action: "info", sequence: 3 },
        implemented: false,
        payload: { "clan|info": { status: 203, error: "clan|info is not implemented" }, sq: 3 },
      }),
    );
    OaAccessLog.write(
      log,
      OaAccessLog.failed({
        accountId: null,
        envelope: undefined,
        error: new Error("Unsupported AMF3 marker 0xff"),
      }),
    );
    expect(lines).toEqual([
      {
        level: "info",
        obj: { oa: expect.objectContaining({ outcome: "unsupported" }) },
        msg: "oa",
      },
      {
        level: "error",
        obj: { oa: expect.objectContaining({ outcome: "decode_failure" }) },
        msg: "oa",
      },
    ]);
    expect(JSON.stringify(lines)).not.toMatch(secretProbe);
  });
});
