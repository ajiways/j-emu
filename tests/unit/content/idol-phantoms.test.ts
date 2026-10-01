import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Artifact = {
  id: number;
  title: string;
  kindId: number;
  extra?: { spell?: { effects: { kind: number; botArtikulId?: number }[] } };
};
type Bot = { id: number };

const IDOL_KIND_ID = 35;

const content = (file: string): unknown =>
  JSON.parse(readFileSync(path.resolve(process.cwd(), "content", file), "utf8"));

/**
 * Idols whose phantom has no stats anywhere: the item carries no STR/VIT and no mana to scale
 * from, so there is nothing to author the mob from (nothing is invented). Calling one fails
 * loudly with "absent from the catalog".
 */
const PHANTOMS_WITHOUT_DATA = new Set([327, 1146, 1384]);

describe("the phantoms of the idols", () => {
  it("are all in the bot catalog, except the idols that carry no stats", () => {
    const items = content("pub1-items.generated.json") as Artifact[];
    const bots = new Set((content("bots.generated.json") as Bot[]).map((bot) => bot.id));
    const missing = new Set<number>();
    for (const item of items.filter((entry) => entry.kindId === IDOL_KIND_ID)) {
      for (const effect of item.extra?.spell?.effects ?? []) {
        const bot = effect.kind === 10 ? effect.botArtikulId : undefined;
        if (bot !== undefined && !bots.has(bot)) missing.add(bot);
      }
    }
    expect([...missing].sort((a, b) => a - b)).toEqual(
      [...PHANTOMS_WITHOUT_DATA].sort((a, b) => a - b),
    );
  });
});
