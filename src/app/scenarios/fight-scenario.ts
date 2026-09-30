import { z } from "zod";

const positiveInt = z.number().int().positive();

const spellCard = z
  .object({
    artikulId: positiveInt,
    slot: z.enum(["fight_start", "prefer", "turn_roulette", "never"]),
    weight: z.number().int().nonnegative(),
    maxCasts: positiveInt.nullable(),
    gate: z.enum(["self_hp_le", "once", "foe_has_dispel_groups"]).nullable(),
    hpPct: positiveInt.nullable(),
  })
  .strict();

const scenarioBot = z
  .object({
    /** Catalog bot that supplies the look (title, level, avatar); stats below replace its own. */
    botArtikulId: positiveInt,
    hp: positiveInt,
    strength: positiveInt,
    nothingWeight: z.number().int().nonnegative(),
    spells: z.array(spellCard),
  })
  .strict();

const scenarioSchema = z
  .object({
    description: z.string().min(1),
    /** `hunt` is one bot against the hero; a roster with allies or several enemies is a `quest` fight. */
    purpose: z.enum(["hunt", "quest"]),
    hero: z.object({ hp: positiveInt }).strict(),
    enemies: z.array(scenarioBot).min(1),
    allies: z.array(scenarioBot),
  })
  .strict();

export type FightScenarioBot = z.infer<typeof scenarioBot>;
export type FightScenario = Readonly<{ name: string } & z.infer<typeof scenarioSchema>>;

export function parseFightScenario(name: string, raw: unknown): FightScenario {
  const parsed = scenarioSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Fight scenario ${name} is invalid: ${issues}`);
  }
  const data = parsed.data;
  if (data.purpose === "hunt" && (data.enemies.length > 1 || data.allies.length > 0)) {
    throw new Error(`Fight scenario ${name}: a hunt scenario takes one enemy and no allies`);
  }
  return { name, ...data };
}
