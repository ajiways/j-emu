import { z } from "zod";
import { ARTIFACT_KIND_SET_BONUS } from "../../catalog/domain/artifact-kind.ts";

const artifactSkillSchema = z
  .object({
    id: z.string().min(1),
    value: z.number().int(),
    flags: z.number().int().nonnegative(),
  })
  .strict();

const artifactActionSchema = z
  .object({
    code: z.string(),
    param1: z.number().int().nonnegative(),
    param2: z.number().int().nonnegative(),
    dispose: z.union([z.literal(0), z.literal(1)]),
    title: z.string().min(1),
    bonusId: z.number().int().nonnegative().optional(),
    description: z.string().optional(),
  })
  .strict()
  .transform((action) => ({
    code: action.code,
    param1: action.param1,
    param2: action.param2,
    dispose: action.dispose,
    title: action.title,
    bonusId: action.bonusId === undefined ? 0 : action.bonusId,
    description: action.description === undefined ? "" : action.description,
  }));

const artifactSpellSkillSchema = z
  .object({
    skill_id: z.string().min(1),
    value: z.number(),
  })
  .strict();

const artifactSpellEffectSchema = z
  .object({
    kind: z.number().int().positive(),
    amount: z.union([z.number(), z.string()]).optional(),
    dmgType: z.number().int().nonnegative().optional(),
    charging: z.number().int().positive().optional(),
    capacity: z.number().int().positive().optional(),
    order: z.number().int().optional(),
    hidden: z.number().int().nonnegative().optional(),
    targetCount: z.number().int().positive().optional(),
    duration: z.number().int().nonnegative().optional(),
    forceSelfTargeting: z.boolean().optional(),
    realStartTime: z.boolean().optional(),
    skills: z.array(artifactSpellSkillSchema).optional(),
  })
  .strict();

export const artifactSpellSchema = z
  .object({
    animData: z.string().min(1).optional(),
    groupId: z.number().int().positive().optional(),
    cooldown: z.number().int().nonnegative().optional(),
    endTurn: z.boolean().optional(),
    flags: z.union([z.string(), z.number()]).optional(),
    persRestr: z.record(z.string(), z.unknown()).optional(),
    targetRestr: z.record(z.string(), z.unknown()).optional(),
    triggers: z.unknown().optional(),
    onlyPvP: z.unknown().optional(),
    effects: z.array(artifactSpellEffectSchema).min(1),
  })
  .strict();

const artifactGloveSocketSchema = z
  .object({
    id: z.number().int().positive().optional(),
    cost: z.number().int().positive(),
    row: z.number().int().positive(),
    artikul_id0: z.number().int().positive(),
  })
  .strict();

const artifactSetSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(1),
    bonus1: z.number().int().nonnegative().optional(),
    bonus2: z.number().int().nonnegative().optional(),
    bonus3: z.number().int().nonnegative().optional(),
    bonus4: z.number().int().nonnegative().optional(),
    bonus5: z.number().int().nonnegative().optional(),
    bonus6: z.number().int().nonnegative().optional(),
    bonus7: z.number().int().nonnegative().optional(),
    bonus8: z.number().int().nonnegative().optional(),
    bonus9: z.number().int().nonnegative().optional(),
    avatar_man: z.string(),
    avatar_woman: z.string(),
  })
  .strict();

const artifactExtraSchema = z
  .object({
    spell: artifactSpellSchema.optional(),
    spells: z.array(artifactGloveSocketSchema).optional(),
    hits: z.array(z.number().int().min(1).max(3)).optional(),
    trend: z.number().int().min(0).max(3).optional(),
    set: artifactSetSchema.optional(),
    param1: z.number().int().nonnegative().optional(),
    flagsExt: z.number().int().nonnegative().optional(),
  })
  .strict()
  .transform((extra) => ({
    ...(extra.spell ? { spell: extra.spell } : {}),
    ...(extra.spells ? { spells: extra.spells } : {}),
    ...(extra.hits ? { hits: extra.hits } : {}),
    ...(extra.trend !== undefined ? { trend: extra.trend } : {}),
    ...(extra.set ? { set: extra.set } : {}),
    ...(extra.param1 !== undefined ? { param1: extra.param1 } : {}),
    ...(extra.flagsExt !== undefined ? { flagsExt: extra.flagsExt } : {}),
  }));

export const artifactDocumentSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(1),
    picture: z.string(),
    typeId: z.string().min(1),
    kindId: z.number().int().nonnegative(),
    slotMask: z.number().int().nonnegative(),
    weight: z.number().int().nonnegative(),
    levelMin: z.number().int().nonnegative(),
    levelMax: z.number().int().nonnegative(),
    gender: z.number().int().nonnegative(),
    priceMinor: z.number().int().nonnegative(),
    flags: z.number().int().nonnegative(),
    bagStack: z.number().int().positive(),
    durability: z.number().int().nonnegative(),
    durabilityMax: z.number().int().nonnegative(),
    skills: z.array(artifactSkillSchema),
    artifact_actions: z.record(z.string().min(1), artifactActionSchema),
    extra: artifactExtraSchema,
  })
  .strict()
  .refine((artifact) => artifact.durability <= artifact.durabilityMax, {
    message: "durability must be <= durabilityMax",
  })
  .refine(
    (artifact) => artifact.picture.length > 0 || artifact.kindId === ARTIFACT_KIND_SET_BONUS,
    {
      message: "picture is required except for kind 139",
    },
  );
