import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const E2E_BOT_IDS = [2, 4, 24, 32, 99, 106, 107, 108, 109, 353, 354, 373] as const;

describe("Pub1 generated bot corpus", () => {
  const bots = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "content/bots.generated.json"), "utf8"),
  ) as Array<{ id: number; title: string }>;
  const loot = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "content/bot-loot.generated.json"), "utf8"),
  ) as Array<{ botId: number }>;
  const books = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "content/bot-spell-books.generated.json"), "utf8"),
  ) as Array<{ botId: number; spells: Array<{ artikulId: number }> }>;
  const byId = new Map(bots.map((row) => [row.id, row]));
  const bookById = new Map(books.map((row) => [row.botId, row]));

  it("keeps wire IDs of e2e bots", () => {
    expect(bots).toHaveLength(164);
    expect(loot).toHaveLength(164);
    expect(books).toHaveLength(164);
    for (const id of E2E_BOT_IDS) {
      expect(byId.get(id)?.id, `missing bot ${id}`).toBe(id);
    }
    expect(byId.get(2)?.title).toBe("Грызл");
    expect(bookById.get(2)?.spells).toEqual([]);
    expect(bookById.get(4)?.spells.map((card) => card.artikulId)).toEqual([396, 397]);
  });
});
