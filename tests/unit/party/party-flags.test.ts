import { describe, expect, it } from "vitest";
import {
  bitsFromFlags,
  FLAG_JOIN_CONFIRM,
  FLAG_KILL_ALL,
  flagsFromBits,
  partyFlagSet,
} from "../../../src/modules/party/domain/party-flags.ts";
import { partyBanKey } from "../../../src/modules/party/domain/party-ban-key.ts";
import { lootRulesLabel } from "../../../src/modules/party/domain/loot-rules-label.ts";
import { partyChannel } from "../../../src/modules/party/domain/party-channel.ts";
import {
  emptyBagPayload,
  emptyMembersPayload,
  emptySettingsPayload,
} from "../../../src/modules/jugger-wire/application/party-wire.ts";

describe("party flags and dump chrome", () => {
  it("packs kill_all and join_confirm bits", () => {
    expect(partyFlagSet("1")).toBe(true);
    expect(partyFlagSet("true")).toBe(true);
    expect(partyFlagSet(0)).toBe(false);
    expect(bitsFromFlags({ kill_all: 1, join_confirm: "true" })).toBe(
      FLAG_KILL_ALL | FLAG_JOIN_CONFIRM,
    );
    expect(flagsFromBits(FLAG_KILL_ALL | FLAG_JOIN_CONFIRM)).toEqual({
      kill_all: true,
      join_confirm: true,
    });
  });

  it("uses dump 32-hex ban key and 4: channel", () => {
    const key = partyBanKey(7, 11);
    expect(key).toHaveLength(32);
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(partyChannel(3)).toBe("4:3");
  });

  it("labels loot rules 2/3 and keeps empty wire chrome", () => {
    expect(lootRulesLabel("1")).toBeNull();
    expect(lootRulesLabel("2")).toBe("раздает лидер");
    expect(lootRulesLabel("3")).toBe("по жребию");
    expect(emptyMembersPayload()).toEqual({ status: 100, members: [] });
    expect(emptyBagPayload()).toEqual({ status: 100, artikuls: [], types: [] });
    expect(emptySettingsPayload()).toMatchObject({
      status: 100,
      flags: 0,
      is_search: 0,
      password: "",
      instance_artikul_id: 0,
    });
  });
});
