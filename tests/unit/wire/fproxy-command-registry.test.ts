import { describe, expect, it } from "vitest";
import { encodeAmf3 } from "../../../src/modules/jugger-wire/amf/amf3.ts";
import { encodeFrames } from "../../../src/modules/jugger-wire/amf/framing.ts";
import { ProtocolError } from "../../../src/modules/jugger-wire/application/protocol-error.ts";
import { FproxyAuthCommand } from "../../../src/modules/jugger-wire/commands/fproxy/fproxy-auth-command.ts";
import { FproxyCastSpellCommand } from "../../../src/modules/jugger-wire/commands/fproxy/fproxy-cast-spell-command.ts";
import { FproxyLeaveFightCommand } from "../../../src/modules/jugger-wire/commands/fproxy/fproxy-leave-fight-command.ts";
import { FproxyPollCommand } from "../../../src/modules/jugger-wire/commands/fproxy/fproxy-poll-command.ts";
import { FproxyCommandRegistry } from "../../../src/modules/jugger-wire/registry/fproxy-command-registry.ts";

const meleeSourceIds = { left: 1, center: 2, right: 3 };

describe("fproxy command registry", () => {
  it("registers auth, poll, leaveFight and castSpell once", () => {
    const registry = FproxyCommandRegistry.fromMeleeSourceIds(meleeSourceIds);
    expect(registry.keys()).toEqual([...FproxyCommandRegistry.requiredKeys].sort());
    expect(new Set(registry.keys()).size).toBe(FproxyCommandRegistry.requiredKeys.length);
  });

  it("rejects a duplicate key at construction", () => {
    expect(
      () =>
        new FproxyCommandRegistry([
          new FproxyAuthCommand(),
          new FproxyAuthCommand(),
          new FproxyPollCommand(),
        ]),
    ).toThrow(/Duplicate fproxy command key auth/);
  });

  it("decodes an empty HTTP body and a 1-byte AMF null as poll", () => {
    const registry = FproxyCommandRegistry.fromMeleeSourceIds(meleeSourceIds);
    expect(registry.decodeHttpBody(Buffer.alloc(0))).toEqual({ kind: "poll" });
    expect(registry.decodeHttpBody(encodeAmf3(null))).toEqual({ kind: "poll" });
    expect(registry.decodeHttpBody(Buffer.from([0x00]))).toEqual({ kind: "poll" });
  });

  it("decodes auth and melee castSpell payloads", () => {
    const registry = FproxyCommandRegistry.fromMeleeSourceIds(meleeSourceIds);
    expect(registry.decodePayload(encodeAmf3({ rc: "auth", eid: "fight-1", sq: 1 }))).toEqual({
      kind: "authenticate",
      fightId: "fight-1",
      sequence: 1,
    });
    expect(registry.decodePayload(encodeFrames([{ rc: "auth", eid: "fight-1", sq: 1 }]))).toEqual({
      kind: "authenticate",
      fightId: "fight-1",
      sequence: 1,
    });
    expect(
      registry.decodePayload(encodeAmf3({ rc: "castSpell", srcType: 1, srcId: 2, sq: 2 })),
    ).toEqual({ kind: "strike", side: "center", sequence: 2 });
    expect(
      registry.decodePayload(encodeAmf3({ rc: "castSpell", srcType: 2, srcId: 100001, sq: 3 })),
    ).toEqual({ kind: "pocket", itemId: 100001, sequence: 3 });
    expect(
      registry.decodePayload(encodeAmf3({ rc: "castSpell", srcType: 3, srcId: 9098, sq: 4 })),
    ).toEqual({ kind: "glove", spellId: 9098, sequence: 4 });
    expect(
      registry.decodePayload(encodeAmf3({ rc: "castSpell", srcType: 1, srcId: 6, sq: 5 })),
    ).toEqual({ kind: "rage", sequence: 5 });
    expect(
      registry.decodePayload(encodeAmf3({ rc: "castSpell", srcType: 1, srcId: 7, sq: 6 })),
    ).toEqual({ kind: "aggro", sequence: 6 });
    expect(registry.decodePayload(encodeAmf3({ rc: "leaveFight", sq: 7 }))).toEqual({
      kind: "leave",
      sequence: 7,
    });
    expect(registry.decodePayload(encodeAmf3({ rc: "persInfo", sq: 8 }))).toEqual({
      kind: "pers-info",
      sequence: 8,
    });
    expect(registry.decodePayload(encodeAmf3({ rc: "persEff", persId: 2, sq: 9 }))).toEqual({
      kind: "pers-effects",
      persId: 2,
      sequence: 9,
    });
    expect(new FproxyLeaveFightCommand().decode({ rc: "leaveFight", sq: "8" })).toEqual({
      kind: "leave",
      sequence: "8",
    });
  });

  it("rejects malformed and unsupported fight payloads", () => {
    const registry = FproxyCommandRegistry.fromMeleeSourceIds(meleeSourceIds);
    expect(() => registry.decodeHttpBody("auth")).toThrow(ProtocolError);
    expect(() => registry.decodeHttpBody("auth")).toThrow(/Fight body must be binary/);
    expect(() => registry.decodePayload(encodeAmf3({ rc: "auth", eid: "1" }))).toThrow(
      /Fight command requires sq/,
    );
    expect(() => registry.decodePayload(encodeAmf3({ rc: "auth", sq: 1 }))).toThrow(
      /Fight auth requires eid/,
    );
    expect(() => registry.decodePayload(encodeAmf3({ rc: "nope", sq: 1 }))).toThrow(
      /Fight command nope is unsupported/,
    );
    expect(() =>
      registry.decodePayload(encodeAmf3({ rc: "castSpell", srcType: 9, srcId: 2, sq: 1 })),
    ).toThrow(/Fight source type 9 is unsupported/);
    expect(() =>
      registry.decodePayload(encodeAmf3({ rc: "castSpell", srcType: 1, srcId: 99, sq: 1 })),
    ).toThrow(/Fight source id 99 is unsupported/);
    expect(() => registry.decodePayload(encodeAmf3({ rc: "persEff", sq: 1 }))).toThrow(
      /Fight persEff requires persId/,
    );
    expect(() => new FproxyCastSpellCommand(meleeSourceIds).decode(null)).toThrow(
      /Fight command must be an object/,
    );
  });
});
