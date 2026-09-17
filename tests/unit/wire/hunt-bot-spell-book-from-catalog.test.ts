import { describe, expect, it } from "vitest";
import { BotSpellBook } from "../../../src/modules/catalog/domain/bot-spell-book.ts";
import { huntBotSpellBookFromCatalog } from "../../../src/modules/jugger-wire/application/hunt-bot-spell-book-from-catalog.ts";

describe("huntBotSpellBookFromCatalog", () => {
  const book = new BotSpellBook(100, [
    {
      artikulId: 396,
      slot: "turn_roulette",
      weight: 10,
      maxCasts: null,
      gate: null,
      hpPct: null,
      spell: { animData: "magic_direct", endTurn: true, effects: [{ kind: 1 }] },
    },
  ]);

  it("copies catalog title and picture onto the hunt snapshot", async () => {
    const mapped = await huntBotSpellBookFromCatalog(book, {
      artifact: async (id) =>
        id === 396 ? { title: "Ядовитый плевок", picture: "hissa_magic1.png" } : null,
    });
    expect(mapped.spells[0]).toMatchObject({
      artikulId: 396,
      title: "Ядовитый плевок",
      picture: "hissa_magic1.png",
    });
  });

  it("fails when the spell artikul is missing from the catalog", async () => {
    await expect(huntBotSpellBookFromCatalog(book, { artifact: async () => null })).rejects.toThrow(
      /Bot spell 396 artifact is missing/,
    );
  });
});
