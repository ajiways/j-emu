import { z } from "zod";
import { SUM_REPUTATION_OBJECT_ID } from "../../catalog/domain/reputation-ids.ts";

export const reputationTrackDocumentSchema = z
  .object({
    objectId: z
      .number()
      .int()
      .positive()
      .refine((objectId) => objectId !== SUM_REPUTATION_OBJECT_ID, {
        message: "Reputation track 36 is derived SUM and cannot be published",
      }),
    type: z.literal(2),
    title: z.string().min(1),
    image: z.string().min(1),
    unlockFlag: z.literal(""),
  })
  .strict();

export const reputationTracksSchema = z.array(reputationTrackDocumentSchema);
