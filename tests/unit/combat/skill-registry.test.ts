import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SKILL_REGISTRY, skillSupport } from "../../../src/modules/combat/domain/skill-registry.ts";
import { unsupportedSkillsOf } from "../../../src/modules/combat/domain/unsupported-skills.ts";

type CatalogEffect = { kind: number; skills?: { skill_id: string }[] };
type CatalogSpell = { effects: CatalogEffect[] };

function catalogSpells(): CatalogSpell[] {
  const items = JSON.parse(readFileSync("content/pub1-items.generated.json", "utf8")) as {
    extra?: { spell?: CatalogSpell };
  }[];
  const books = JSON.parse(readFileSync("content/bot-spell-books.generated.json", "utf8")) as {
    spells: { spell: CatalogSpell }[];
  }[];
  return [
    ...items.flatMap((item) => (item.extra?.spell ? [item.extra.spell] : [])),
    ...books.flatMap((book) => book.spells.map((card) => card.spell)),
  ];
}

describe("skill registry", () => {
  it("knows every skill the catalog uses, on an effect kind that has a skill context", () => {
    const used = new Set<string>();
    for (const spell of catalogSpells()) {
      for (const effect of spell.effects) {
        for (const skill of effect.skills ?? []) {
          used.add(skill.skill_id);
          expect(() => skillSupport(skill.skill_id, effect.kind), skill.skill_id).not.toThrow();
        }
      }
    }
    expect(used.size).toBeGreaterThan(30);
  });

  it("carries no skill the catalog does not use", () => {
    const used = new Set<string>();
    for (const spell of catalogSpells()) {
      for (const effect of spell.effects) {
        for (const skill of effect.skills ?? []) used.add(skill.skill_id);
      }
    }
    expect(Object.keys(SKILL_REGISTRY).filter((id) => !used.has(id))).toEqual([]);
  });

  it("fails on an unknown skill and on a kind without a skill context", () => {
    expect(() => skillSupport("NOT_A_SKILL", 3)).toThrow(/not in the skill registry/);
    expect(() => skillSupport("STR", 8)).toThrow(/no skill context/);
  });
});

describe("unsupportedSkillsOf", () => {
  it("lists deferred skills per effect and passes supported ones", () => {
    const spell = {
      effects: [
        {
          kind: 3,
          skills: [
            { skillId: "STR", value: 5 },
            { skillId: "DEX", value: 19 },
            { skillId: "pcDEX", value: 23 },
            { skillId: "DEF", value: 0 },
            { skillId: "VIT", value: 5 },
          ],
        },
        { kind: 1, skills: [{ skillId: "pcSTR", value: 10 }] },
      ],
    };
    expect(unsupportedSkillsOf(spell, "human")).toEqual([{ skillId: "VIT", effectKind: 3 }]);
    expect(unsupportedSkillsOf(spell, "bot")).toEqual([
      { skillId: "DEX", effectKind: 3 },
      { skillId: "pcDEX", effectKind: 3 },
      { skillId: "VIT", effectKind: 3 },
    ]);
  });
});
