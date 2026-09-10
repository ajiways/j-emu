import { describe, expect, it } from "vitest";
import type { CombatPort } from "../../../src/modules/combat/ports/combat-port.ts";
import { requireNoActiveFight } from "../../../src/modules/jugger-wire/commands/oa/require-no-active-fight.ts";

describe("requireNoActiveFight", () => {
  it("allows inventory mutations when no fight is active", async () => {
    await expect(requireNoActiveFight(fakeCombat(null), 1)).resolves.toBeUndefined();
  });

  it("returns status 203 while a fight is active", async () => {
    await expect(requireNoActiveFight(fakeCombat("7"), 1)).rejects.toMatchObject({
      name: "ProtocolError",
      status: 203,
      message: "нельзя во время боя",
    });
  });
});

function fakeCombat(fightId: string | null): CombatPort {
  return {
    startHunt: async () => {
      throw new Error("unused");
    },
    joinHunt: async () => {
      throw new Error("unused");
    },
    startFriendlyDuel: async () => {
      throw new Error("unused");
    },
    hasFight: async () => false,
    nextFightId: async () => {
      throw new Error("unused");
    },
    execute: async () => [],
    takePocketConsume: () => null,
    activeFightId: async () => fightId,
    resumeFight: async () => null,
    accountForFight: async () => null,
    takeExit: async () => null,
    peekExit: async () => null,
    takeLoot: async () => null,
    peekLoot: async () => null,
  };
}
