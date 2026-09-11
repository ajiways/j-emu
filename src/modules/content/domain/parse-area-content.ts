import { z } from "zod";

const flag = z.union([z.literal(0), z.literal(1)]);

export const areaDocumentSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    parentId: z.string(),
    map: z.string().min(1),
    fightBackground: z.string().min(1),
    regionMap: z.string().min(1),
    ftimeMax: z.number().int().nonnegative(),
    code: z.string(),
    context: z.string(),
    soundIntro: z.string(),
    soundBg: z.string(),
    instArtikulId: z.number().int().nonnegative(),
    haveTradeChannel: flag,
    haveKindChannel: flag,
    hideFinishedFights: flag,
    hideRunningFights: flag,
    noClanChat: flag,
    bgId: z.string(),
  })
  .strict();

export const areaLinkDocumentSchema = z
  .object({
    fromAreaId: z.string().min(1),
    itemId: z.number().int().nonnegative(),
    toAreaId: z.string().min(1),
    title: z.string(),
    picture: z.string(),
    description: z.string(),
    flags: z.number().int().nonnegative(),
    direction: z.number().int().nonnegative(),
    confirmQuestion: z.literal(""),
    toId: z.string().min(1),
    href: z
      .object({
        object: z.literal("common"),
        action: z.literal("action"),
        form: z
          .object({
            code: z.literal("COME_IN"),
            area_id: z.number().int().positive(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
