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

const heroGlove = z
  .object({
    /** The eight L/C/R combo steps (1 left, 2 center, 3 right) that earn combo points. */
    hits: z.array(z.number().int().min(1).max(3)).length(8),
    spells: z
      .array(z.object({ artikulId: positiveInt, cost: positiveInt, row: positiveInt }).strict())
      .min(1),
  })
  .strict();

const heroSchema = z
  .object({
    hp: positiveInt,
    /** Max hp for this fight; `null` keeps the hero's own. Baking of hp buffs starts from it. */
    maxHp: positiveInt.nullable(),
    glove: heroGlove.nullable(),
    /** Pocket items the hero is given (real items, put in his pocket) before the fight. */
    pocket: z.array(z.object({ artikulId: positiveInt, count: positiveInt }).strict()),
  })
  .strict()
  .refine((hero) => hero.maxHp === null || hero.hp <= hero.maxHp, {
    message: "hero.hp must not exceed hero.maxHp",
  });

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
    /** `glove` replaces the hero's equipped glove for this fight; `null` keeps his own. */
    hero: heroSchema,
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
