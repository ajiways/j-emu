import { describe, expect, it } from "vitest";
import { ProtocolError } from "../../../src/modules/jugger-wire/application/protocol-error.ts";
import type { OaCommand } from "../../../src/modules/jugger-wire/commands/oa/oa-command.ts";
import {
  decodeObjectActionEnvelope,
  oaRegistryKey,
  oaResponseKey,
} from "../../../src/modules/jugger-wire/commands/oa/object-action-envelope.ts";
import { OaCommandRegistry } from "../../../src/modules/jugger-wire/registry/oa-command-registry.ts";

describe("OA command registry", () => {
  it("registers each playable key once", () => {
    const registry = new OaCommandRegistry(OaCommandRegistry.requiredKeys.map(stub));
    expect(registry.keys()).toEqual([...OaCommandRegistry.requiredKeys].sort());
    expect(new Set(registry.keys()).size).toBe(OaCommandRegistry.requiredKeys.length);
  });

  it("rejects a duplicate key at construction", () => {
    expect(
      () => new OaCommandRegistry([stub("common|init"), stub("common|init"), ...extraStubs()]),
    ).toThrow(/Duplicate OA command key common\|init/);
  });

  it("returns nested status 203 for an unknown key", async () => {
    const registry = new OaCommandRegistry(OaCommandRegistry.requiredKeys.map(stub));
    const result = await registry.dispatch(1, {
      object: "clan",
      action: "info",
      sequence: 1,
    });
    expect(result).toEqual({
      kind: "nested",
      value: { status: 203, error: "clan|info is not implemented" },
    });
  });

  it("returns nested status 203 for an unknown common|object code", async () => {
    const registry = new OaCommandRegistry(OaCommandRegistry.requiredKeys.map(stub));
    const result = await registry.dispatch(1, {
      object: "common",
      action: "object",
      form: { code: "OPEN_WINDOW" },
      sequence: 1,
    });
    expect(result).toEqual({
      kind: "nested",
      value: { status: 203, error: "common|object code OPEN_WINDOW is not implemented" },
    });
  });
});

describe("object-action envelope decoder", () => {
  it("rejects a non-object payload", () => {
    expect(() => decodeObjectActionEnvelope("init")).toThrow(ProtocolError);
    expect(() => decodeObjectActionEnvelope("init")).toThrow(
      /AMF object-action payload must be an object/,
    );
  });

  it("requires object, action and sq", () => {
    expect(() => decodeObjectActionEnvelope({ object: "common", action: "init" })).toThrow(
      /AMF object, action and sq are required/,
    );
  });

  it("rejects a dense form array", () => {
    expect(() =>
      decodeObjectActionEnvelope({
        object: "common",
        action: "object",
        form: ["ATTACK_BOT"],
        sq: 1,
      }),
    ).toThrow(/AMF form must not contain dense array values/);
  });

  it("builds multiplexed registry and error keys", () => {
    const envelope = decodeObjectActionEnvelope({
      object: "common",
      action: "object",
      form: { code: "ATTACK_BOT", bot_id: 2 },
      sq: 4,
    });
    expect(oaRegistryKey(envelope)).toBe("common|object:ATTACK_BOT");
    expect(oaResponseKey(envelope)).toBe("common|action");
  });

  it("requires form for common|object lookup", () => {
    const envelope = decodeObjectActionEnvelope({
      object: "common",
      action: "object",
      sq: 1,
    });
    expect(() => oaRegistryKey(envelope)).toThrow(/common\|object requires form/);
  });
});

function stub(key: string): OaCommand {
  return {
    key,
    execute: async () => ({ kind: "nested", value: { status: 100 } }),
  };
}

function extraStubs(): OaCommand[] {
  return OaCommandRegistry.requiredKeys.filter((key) => key !== "common|init").map(stub);
}
