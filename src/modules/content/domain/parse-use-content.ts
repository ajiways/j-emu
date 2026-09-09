import { z } from "zod";

const useScriptRequireSchema = z
  .object({
    artikulId: z.number().int().positive(),
    count: z.number().int().positive(),
  })
  .strict();

const useScriptEffectSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("consume"),
      artikulId: z.number().int().positive(),
      count: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal("grant"),
      artikulId: z.number().int().positive(),
      count: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal("openDialog"),
      dialogKey: z.string().min(1),
      npcId: z.number().int().positive(),
    })
    .strict(),
]);

export const bonusDocumentSchema = z
  .object({
    id: z.number().int().positive(),
    kind: z.literal("skill"),
    skillId: z.string().min(1),
    delta: z.number().int(),
    needValue: z.number().int().nonnegative(),
    artikulId: z.number().int().positive(),
    title: z.string().min(1),
    chatMsg: z.string(),
  })
  .strict()
  .refine((bonus) => bonus.delta !== 0, { message: "bonus delta must be non-zero" });

export const useScriptDocumentSchema = z
  .object({
    bonusId: z.number().int().positive(),
    require: z.array(useScriptRequireSchema),
    failPlaque: z.string(),
    effects: z.array(useScriptEffectSchema).min(1),
  })
  .strict();
