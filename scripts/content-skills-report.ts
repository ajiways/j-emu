import { readFileSync } from "node:fs";
import { SKILL_REGISTRY, skillSupport } from "../src/modules/combat/domain/skill-registry.ts";

type CatalogSpell = {
  effects: { kind: number; skills?: { skill_id: string; value: number }[] }[];
};
type CatalogItem = { id: number; title: string; extra?: { spell?: CatalogSpell } };
type SpellBookRow = { spells: { artikulId: number; spell: CatalogSpell }[] };

const items = JSON.parse(
  readFileSync("content/pub1-items.generated.json", "utf8"),
) as CatalogItem[];
const books = JSON.parse(
  readFileSync("content/bot-spell-books.generated.json", "utf8"),
) as SpellBookRow[];

const titles = new Map(items.map((item) => [item.id, item.title]));
const spells = new Map<number, CatalogSpell>();
for (const item of items) if (item.extra?.spell) spells.set(item.id, item.extra.spell);
for (const book of books) for (const card of book.spells) spells.set(card.artikulId, card.spell);

const perSkill = new Map<string, { effects: number; spells: Set<number> }>();
const affected = new Set<number>();
for (const [artikulId, spell] of spells) {
  for (const effect of spell.effects) {
    for (const entry of effect.skills ?? []) {
      const row = perSkill.get(entry.skill_id) ?? { effects: 0, spells: new Set<number>() };
      row.effects += 1;
      row.spells.add(artikulId);
      perSkill.set(entry.skill_id, row);
      if (skillSupport(entry.skill_id, effect.kind) === "deferred") affected.add(artikulId);
    }
  }
}

const rows = [...perSkill.entries()].sort((left, right) => right[1].effects - left[1].effects);
process.stdout.write("skill\teffects\tspells\tbuff\tpayload\tevidence\tmeaning\texample\n");
for (const [skillId, usage] of rows) {
  const entry = SKILL_REGISTRY[skillId];
  if (!entry) throw new Error(`Skill ${skillId} is not in the skill registry`);
  const example = [...usage.spells]
    .slice(0, 2)
    .map((id) => `${id} ${titles.get(id) ?? "(bot spell)"}`)
    .join("; ");
  process.stdout.write(
    `${skillId}\t${usage.effects}\t${usage.spells.size}\t${entry.buff}\t${entry.payload}\t${entry.evidence}\t${entry.meaning}\t${example}\n`,
  );
}
process.stdout.write(`\nspells carrying a deferred skill: ${affected.size} of ${spells.size}\n`);
