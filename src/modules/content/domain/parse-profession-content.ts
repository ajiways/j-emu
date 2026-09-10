import { z } from "zod";
import { PROFESSION_ID_MAX, PROFESSION_ID_MIN } from "../../catalog/domain/profession-ids.ts";

const overrideSchema = z.number().int().nullable();

const professionDocumentSchema = z
  .object({
    id: z.number().int().min(PROFESSION_ID_MIN).max(PROFESSION_ID_MAX),
    title: z.string().min(1),
    type: z.union([z.literal(1), z.literal(2)]),
    skillId: z.string().min(1),
    picture: z.string().min(1),
    position: z.number().int().positive(),
    skillStepOverride: overrideSchema,
    skillMinlvlOverride: overrideSchema,
    description: z.string().min(1),
    infoUrl: z.string().min(1),
    userStatId: z.number().int().positive().nullable(),
  })
  .strict();

export const professionsSchema = z.array(professionDocumentSchema);
