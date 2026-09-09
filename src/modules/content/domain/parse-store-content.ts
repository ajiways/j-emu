import { z } from "zod";

const storeTypeSchema = z
  .object({
    areaId: z.string().min(1),
    typeId: z.number().int(),
    title: z.string().min(1),
    ord: z.number().int(),
  })
  .strict();

const storeLotSchema = z
  .object({
    areaId: z.string().min(1),
    lotId: z.number().int().positive(),
    artikulId: z.number().int().positive(),
    typeId: z.number().int(),
    price: z.number().int().nonnegative(),
    ord: z.number().int(),
  })
  .strict();

export const storeTypesSchema = z.array(storeTypeSchema);
export const storeLotsSchema = z.array(storeLotSchema);
