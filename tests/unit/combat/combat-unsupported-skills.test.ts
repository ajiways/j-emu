import { describe, expect, it } from "vitest";
import { createCombatService } from "../../support/create-combat-service.ts";
import {
  EMPTY_HUNT_BOT_SPELL_BOOK,
  unitHuntSpellCard,
  unitHuntStart,
} from "../../support/hunt-start-input.ts";
import { startHuntWithIssuedId } from "../../support/combat-start-hunt.ts";

describe("unsupported skills at fight start", () => {
  it("logs a bot spell skill combat does not apply and lets the fight start", async () => {
    const { combat, diagnostics } = createCombatService({});
    const buff = unitHuntSpellCard({
      artikulId: 6197,
      title: "Сокрушение",
      spell: {
        animData: "magic_baf",
        endTurn: true,
        effects: [
          { kind: 3, skills: [{ skillId: "DFR", value: 0.4 }] },
          { kind: 3, skills: [{ skillId: "STR", value: 5 }] },
        ],
      },
    });
    const start = await startHuntWithIssuedId(
      combat,
      unitHuntStart({
        botSpellBook: { ...EMPTY_HUNT_BOT_SPELL_BOOK, nothingWeight: 100, spells: [buff] },
      }),
    );
    expect(start.fightId).toBeTruthy();
    expect(diagnostics.unsupported).toEqual([
      expect.objectContaining({
        fightId: start.fightId,
        source: "bot",
        artikulId: 6197,
        skillId: "DFR",
        effectKind: 3,
      }),
    ]);
  });

  it("reports nothing when every skill is applied", async () => {
    const { combat, diagnostics } = createCombatService({});
    await startHuntWithIssuedId(combat, unitHuntStart({}));
    expect(diagnostics.unsupported).toEqual([]);
  });
});
