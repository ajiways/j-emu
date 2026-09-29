import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { artifactExtraFromJson } from "../../../src/modules/catalog/infrastructure/artifact-extra-from-json.ts";
import { artifactSpellSchema } from "../../../src/modules/content/domain/parse-artifact-content.ts";

type Spell = { effects: Record<string, unknown>[] } & Record<string, unknown>;
type Item = { id: number; extra?: { spell?: Spell } };

const items = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "content/pub1-items.generated.json"), "utf8"),
) as Item[];
const spells = items.flatMap((item) => (item.extra?.spell ? [{ id: item.id, ...item.extra }] : []));

describe("generated spell fields", () => {
  it("accepts every Pub1 spell under the strict content schema", () => {
    for (const { id, spell } of spells) {
      const parsed = artifactSpellSchema.safeParse(spell);
      expect(parsed.success, `artifact ${id}: ${parsed.success ? "" : parsed.error.message}`).toBe(
        true,
      );
    }
  });

  it("keeps the effect fields the fight engine does not read yet", () => {
    const seen = new Set<string>();
    for (const { spell } of spells) {
      for (const effect of spell?.effects ?? [])
        for (const key of Object.keys(effect)) seen.add(key);
    }
    for (const key of [
      "botArtikulId",
      "dmgMask",
      "targetEffectGroupId",
      "targetEffectCount",
      "durationInTurns",
      "limit",
      "delta",
      "skills2",
      "manaCost",
      "targetGroups",
      "chargable",
      "noHasten",
      "useSkill",
      "dont_putoff_after_death",
    ]) {
      expect(seen.has(key), `effect field ${key}`).toBe(true);
    }
  });

  it("carries summon and delta fields through the catalog reader", () => {
    const summon = spells.find((entry) => entry.id === 299);
    const delta = spells.find((entry) => entry.id === 3846);
    if (!summon || !delta) throw new Error("Reference artifacts 299 and 3846 are missing");
    expect(artifactExtraFromJson(299, { spell: summon.spell }).spell).toMatchObject({
      mpCost: 25,
      effects: [{ kind: 10, botArtikulId: 44 }],
    });
    expect(artifactExtraFromJson(3846, { spell: delta.spell }).spell?.effects[1]).toMatchObject({
      kind: 9,
      dmgMask: 253,
      limit: 100,
      delta: { skill: "STR" },
    });
  });
});
