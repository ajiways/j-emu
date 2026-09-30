import { describe, expect, it } from "vitest";
import { HumanCastState } from "../../../src/modules/combat/domain/human-cast-state.ts";
import { EMPTY_COMBAT_LOADOUT } from "../../../src/modules/combat/domain/combat-loadout.ts";

const HITS = [1, 2, 3, 1, 2, 3, 1, 2];

function stateWithGlove(): HumanCastState {
  return new HumanCastState(
    {
      ...EMPTY_COMBAT_LOADOUT,
      glove: {
        hits: HITS,
        spells: [
          {
            artikulId: 1,
            cost: 1,
            row: 1,
            title: "t",
            picture: "p.png",
            spell: { effects: [{ kind: 3 }] },
          },
        ],
      },
    },
    0,
  );
}

describe("glove combo", () => {
  it("resets progress on a wrong step while it is still building", () => {
    const state = stateWithGlove();
    expect(state.advanceCombo("left")).toBe(1);
    expect(state.advanceCombo("left")).toBe(0);
  });

  it("keeps a full combo on any strike", () => {
    const state = stateWithGlove();
    for (const step of HITS) {
      state.advanceCombo(step === 1 ? "left" : step === 2 ? "center" : "right");
    }
    expect(state.cp).toBe(8);
    expect(state.advanceCombo("right")).toBe(8);
    expect(state.advanceCombo("left")).toBe(8);
    expect(state.cp).toBe(8);
  });

  it("keeps building from the spent point after a full combo is used", () => {
    const state = stateWithGlove();
    for (const step of HITS) {
      state.advanceCombo(step === 1 ? "left" : step === 2 ? "center" : "right");
    }
    state.spendCombo(4);
    expect(state.cp).toBe(4);
    expect(state.advanceCombo("center")).toBe(5);
  });
});
