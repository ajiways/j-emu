import { describe, expect, it } from "vitest";
import type { CombatPort } from "../../../src/modules/combat/ports/combat-port.ts";
import { FightWireMapper } from "../../../src/modules/jugger-wire/application/fight-wire-mapper.ts";
import { EsrvPollCommand } from "../../../src/modules/jugger-wire/commands/esrv/esrv-poll-command.ts";
import { FightExitEncoder } from "../../../src/modules/jugger-wire/commands/esrv/fight-exit-encoder.ts";
import { EsrvCommandRegistry } from "../../../src/modules/jugger-wire/registry/esrv-command-registry.ts";

describe("esrv command registry", () => {
  it("registers poll and fight-exit once", () => {
    const registry = new EsrvCommandRegistry(
      new EsrvPollCommand(fakeCombat()),
      new FightExitEncoder(fakeWire()),
    );
    expect(registry.keys()).toEqual([...EsrvCommandRegistry.requiredKeys].sort());
    expect(new Set(registry.keys()).size).toBe(EsrvCommandRegistry.requiredKeys.length);
  });

  it("rejects duplicate inbound and outbound keys", () => {
    const poll = new EsrvPollCommand(fakeCombat());
    expect(() => new EsrvCommandRegistry(poll, poll as unknown as FightExitEncoder)).toThrow(
      /Duplicate esrv command key poll/,
    );
  });
});

function fakeCombat(): CombatPort {
  return {
    startHunt: async () => {
      throw new Error("unused");
    },
    execute: async () => [],
    activeFightId: async () => null,
    accountForFight: async () => null,
    takeExit: async () => null,
    peekExit: async () => null,
  };
}

function fakeWire() {
  return new FightWireMapper(
    { host: "s1.jugger.ru", port: 33120, proxyPath: "/fproxy/" },
    {
      heroSkill: 1,
      heroBody: "m1",
      autoFight: 0,
      canLeave: 1,
      companionEnabled: 0,
      isPvp: 0,
      instanceId: "0",
      type: "1",
      isSlaughter: false,
      flags: "0",
    },
  );
}
