import { z } from "zod";
import { artifactSpellSchema } from "./parse-artifact-content.ts";

const flag = z.union([z.literal(0), z.literal(1)]);

const huntLookSchema = z
  .object({
    nick: z.string().min(1),
    swf: z.string().min(1),
    scale: z.number().int().positive(),
    fps: z.number().int().positive(),
    speed: z.number().int().nonnegative(),
    avatar: z.string().min(1),
    kind: z.number().int().nonnegative(),
    hideOnMap: flag,
    sk: z.string().min(1),
    body: z.string(),
  })
  .strict();

const botLootEntrySchema = z
  .object({
    artikulId: z.number().int().positive(),
    dropWeight: z.number().int().nonnegative(),
    countMin: z.number().int().positive(),
    countMax: z.number().int().positive(),
  })
  .strict()
  .refine((entry) => entry.countMax >= entry.countMin, {
    message: "loot countMax must be >= countMin",
  });

const botSpellCardSchema = z
  .object({
    artikulId: z.number().int().positive(),
    slot: z.enum(["fight_start", "prefer", "turn_roulette", "never"]),
    weight: z.number().int().nonnegative(),
    maxCasts: z.number().int().positive().nullable(),
    gate: z.literal("self_hp_le").nullable(),
    hpPct: z.number().int().min(1).max(100).nullable(),
    spell: artifactSpellSchema,
  })
  .strict()
  .refine((card) => (card.gate === "self_hp_le") === (card.hpPct !== null), {
    message: "hpPct is required exactly when gate is self_hp_le",
  });

const botSpellBookSchema = z
  .object({
    nothingWeight: z.number().int().nonnegative(),
    spells: z.array(botSpellCardSchema),
  })
  .strict()
  .refine(
    (book) => new Set(book.spells.map((card) => card.artikulId)).size === book.spells.length,
    { message: "spellBook artikul ids must be unique" },
  );

export const botDocumentSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(1),
    level: z.number().int().positive(),
    maxHp: z.number().int().positive(),
    strength: z.number().int().nonnegative(),
    hunt: huntLookSchema,
    baseExp: z.number().int().nonnegative(),
    moneyMin: z.number().nonnegative(),
    moneyMax: z.number().nonnegative(),
    lootDropCnt: z.number().int().nonnegative(),
    lootBonusChance: z.number().min(0).max(1),
    lootBonusMin: z.number().int().nonnegative(),
    lootBonusMax: z.number().int().nonnegative(),
    lootNothingWeight: z.number().int().nonnegative(),
    lootEntries: z.array(botLootEntrySchema),
    spellBook: botSpellBookSchema,
  })
  .strict()
  .refine((bot) => bot.moneyMax >= bot.moneyMin, { message: "moneyMax must be >= moneyMin" })
  .refine((bot) => bot.lootBonusMax >= bot.lootBonusMin, {
    message: "lootBonusMax must be >= lootBonusMin",
  })
  .refine(
    (bot) =>
      new Set(bot.lootEntries.map((entry) => entry.artikulId)).size === bot.lootEntries.length,
    { message: "lootEntries artikul ids must be unique" },
  );
