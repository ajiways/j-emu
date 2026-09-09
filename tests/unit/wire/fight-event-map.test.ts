import { describe, expect, it } from "vitest";
import { fightEventMap } from "../../../src/modules/jugger-wire/application/fight-event-map.ts";

describe("fightEventMap", () => {
  it("numbers events from 1 like live evMap", () => {
    expect(fightEventMap([{ et: "oppwait" }, { et: "oppnew", nick: "Грызль" }])).toEqual({
      ev: {
        "1": { et: "oppwait" },
        "2": { et: "oppnew", nick: "Грызль" },
      },
    });
  });

  it("rejects an empty event list", () => {
    expect(() => fightEventMap([])).toThrow(/at least one event/);
  });
});
