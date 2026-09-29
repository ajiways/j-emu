import { describe, expect, it } from "vitest";
import { rosterIsPvp } from "../../../src/modules/combat/domain/roster-pvp.ts";
import { createUnitBattle } from "../../support/fight-rules.ts";
import { unitFightJoin, unitHuntFightSetup } from "../../support/fight-setup.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";

const NOW = Date.parse("2026-09-07T12:00:00.000Z");

describe("rosterIsPvp", () => {
  it("needs a human on each team", () => {
    expect(rosterIsPvp([])).toBe(false);
    expect(rosterIsPvp([{ team: 1 }, { team: 1 }])).toBe(false);
    expect(rosterIsPvp([{ team: 1 }, { team: 2 }])).toBe(true);
  });

  it("turns a hunt into PvP once a human joins the monster team, and shows it in the bootstrap", () => {
    const battle = createUnitBattle(unitHuntFightSetup(), new SequenceRandom([1]));
    expect(battle.authenticate(1, NOW)[0]).toMatchObject({ type: "hunt-bootstrap", pvp: false });
    battle.addHuman(unitFightJoin({ nick: "Intervenor", team: 2 }));
    const bootstrap = battle.authenticate(2, NOW)[0];
    expect(bootstrap).toMatchObject({ type: "hunt-bootstrap", pvp: true });
  });
});
