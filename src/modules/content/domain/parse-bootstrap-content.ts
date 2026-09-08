import { z } from "zod";

export const skillDocumentSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    group: z.string().min(1),
    order: z.string().min(1),
    weight: z.string().min(1),
    image: z.string(),
    valueKind: z.union([z.literal("number"), z.literal("string")]),
  })
  .strict();

export const levelBoundaryDocumentSchema = z
  .object({
    level: z.number().int().positive(),
    expMin: z.number().int().nonnegative(),
    expMax: z.number().int().positive(),
    bagCnt: z.number().int().positive(),
    honorRank: z.number().int().nonnegative(),
    honorMin: z.number().int().nonnegative(),
    honorMax: z.number().int().nonnegative(),
    honorStatus: z.number().int().nonnegative(),
    managedSkills: z
      .array(
        z
          .object({
            id: z.string().min(1),
            value: z.number().int(),
          })
          .strict(),
      )
      .min(1),
    evidenceKind: z.union([z.literal("confirmed"), z.literal("legacy_extrapolated")]),
  })
  .strict()
  .refine((row) => row.expMax > row.expMin, { message: "expMax must be greater than expMin" })
  .refine((row) => row.honorMax >= row.honorMin, { message: "honorMax must be >= honorMin" });

export const appearanceDocumentSchema = z
  .object({
    kind: z.number().int().positive(),
    gender: z.number().int().positive(),
    avatarBig: z.string().min(1),
    avatarSmall: z.string().min(1),
  })
  .strict();

export const hudDefaultsDocumentSchema = z
  .object({
    fightId: z.number().int().nonnegative(),
    gagTime: z.number().int().nonnegative(),
    mpTime: z.number().int().nonnegative(),
    epicValue: z.number().int().nonnegative(),
    expStatus: z.number().int().nonnegative(),
    revenge: z.number().int().nonnegative(),
    revengeMin: z.number().int().nonnegative(),
    revengeMax: z.string().min(1),
    revengeStatus: z.number().int().nonnegative(),
    energyPercentMax: z.number().positive(),
    energyPercentCurrent: z.number().nonnegative(),
    injuryTime: z.number().int().nonnegative(),
    injuryArtikulId: z.number().int().nonnegative(),
  })
  .strict();

export const bootstrapChromeDocumentSchema = z
  .object({
    "user|professions": z.unknown(),
    "pet|list": z.unknown(),
    "user|mount_list": z.unknown(),
    "user|campaigns": z.unknown(),
    "chat|area_population": z.unknown(),
    "friend|info": z.unknown(),
    "user|action_stats": z.unknown(),
    "arena|great_fights": z.unknown(),
    "user|time_to_next_achievement": z.unknown(),
    "assistant|farm_info": z.unknown(),
    "bank|info": z.unknown(),
    "user|smiles": z.unknown(),
    "common|antimat": z.unknown(),
    "common|event_conf": z.unknown(),
    "common|front_status": z.unknown(),
    "common|area_capture_info": z.unknown(),
    "common|occurrences_conf": z.unknown(),
    "common|farm_agregate": z.unknown(),
  })
  .strict();

export const commonConfDocumentSchema = z
  .object({
    status: z.literal(100),
    gag_reason_info: z.unknown(),
    kind_info: z.unknown(),
    rank_info: z.unknown(),
    money_info: z.unknown(),
    loot_type_info: z.unknown(),
    quality_info: z.unknown(),
    fight_level_info: z.unknown(),
    great_fight_k1: z.unknown(),
    great_fight_k2: z.unknown(),
    profession_info: z.unknown(),
    assistant_tactics_info: z.unknown(),
    SEAL_PERCENT_COMMON: z.unknown(),
    skill_groups: z.unknown(),
    level_table: z.unknown(),
    rank_table: z.unknown(),
    restriction_modules: z.unknown(),
    HAPPY_BIRTHDAY_DESCRIPTION: z.unknown(),
    HAPPY_BIRTHDAY_IMAGE: z.unknown(),
    HAPPY_BIRTHDAY_PAYMENT_PERCENT: z.unknown(),
    macros_list: z.unknown(),
  })
  .passthrough();

export const welcomeMessageDocumentSchema = z
  .object({
    template: z
      .string()
      .min(1)
      .refine((value) => value.includes("{nick}"), {
        message: "welcome template must contain {nick}",
      }),
  })
  .strict();
