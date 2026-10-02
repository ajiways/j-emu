import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FightScenarioCatalog } from "../../../src/app/scenarios/fight-scenario-catalog.ts";

const bot = {
  botArtikulId: 4,
  hp: 10,
  strength: 1,
  nothingWeight: 100,
  spells: [],
};
const valid = {
  description: "d",
  purpose: "hunt",
  drill: null,
  hero: { hp: 3, maxHp: null, glove: null, stats: null, pocket: [], idols: [] },
  enemies: [bot],
  allies: [],
};

function directoryWith(files: Record<string, string>): string {
  const directory = mkdtempSync(path.join(tmpdir(), "scenarios-"));
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(directory, name), text);
  return directory;
}

describe("FightScenarioCatalog", () => {
  it("loads each JSON file under its file name", () => {
    const catalog = FightScenarioCatalog.load(
      directoryWith({ "one.json": JSON.stringify(valid), "notes.txt": "ignored" }),
    );
    expect(catalog.names()).toEqual(["one"]);
    expect(catalog.find("one")?.hero.hp).toBe(3);
    expect(catalog.find("two")).toBeNull();
  });

  it("takes the hero's stats for the fight and fails on a stats field left out", () => {
    const stats = {
      strength: 200,
      initiative: null,
      rage: null,
      dexterity: null,
      defense: null,
      block: null,
      mp: 50,
    };
    const withStats = { ...valid, hero: { ...valid.hero, stats } };
    const catalog = FightScenarioCatalog.load(
      directoryWith({ "one.json": JSON.stringify(withStats) }),
    );
    expect(catalog.find("one")?.hero.stats).toEqual(stats);
    const incomplete = { ...stats, mp: undefined };
    const bad = { ...valid, hero: { ...valid.hero, stats: incomplete } };
    expect(() =>
      FightScenarioCatalog.load(directoryWith({ "bad.json": JSON.stringify(bad) })),
    ).toThrow(/hero\.stats/);
  });

  it("fails on a missing required field instead of filling it in", () => {
    const incomplete = { description: valid.description, hero: valid.hero, enemies: valid.enemies };
    expect(() =>
      FightScenarioCatalog.load(directoryWith({ "bad.json": JSON.stringify(incomplete) })),
    ).toThrow(/allies/);
  });

  it("rejects a hunt scenario that carries a roster", () => {
    expect(() =>
      FightScenarioCatalog.load(
        directoryWith({ "bad.json": JSON.stringify({ ...valid, allies: [bot] }) }),
      ),
    ).toThrow(/one enemy and no allies/);
  });

  it("fails on an unknown field", () => {
    expect(() =>
      FightScenarioCatalog.load(
        directoryWith({ "bad.json": JSON.stringify({ ...valid, heroHp: 1 }) }),
      ),
    ).toThrow(/heroHp|Unrecognized/);
  });

  it("fails on malformed JSON and on a file name that is not kebab-case", () => {
    expect(() => FightScenarioCatalog.load(directoryWith({ "bad.json": "{" }))).toThrow(
      /not valid JSON/,
    );
    expect(() =>
      FightScenarioCatalog.load(directoryWith({ "Bad_Name.json": JSON.stringify(valid) })),
    ).toThrow(/kebab-case/);
  });
});
