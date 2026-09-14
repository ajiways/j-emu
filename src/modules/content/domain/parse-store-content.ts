import { z } from "zod";
import { isGoldCoins } from "../../catalog/domain/store-pay.ts";

const goldCoinsSchema = z
  .number()
  .nonnegative()
  .refine(isGoldCoins, { message: "gold coins must have at most two decimal places" });

export const storeTypeDocumentSchema = z
  .object({
    areaId: z.string().min(1),
    typeId: z.number().int(),
    title: z.string().min(1),
    ord: z.number().int(),
  })
  .strict();

const goldPaySchema = z
  .object({
    currency: z.literal("gold"),
    amount: goldCoinsSchema,
  })
  .strict();

const diamondPaySchema = z
  .object({
    currency: z.literal("diamond"),
    amount: z.number().int().positive(),
  })
  .strict();

const barterPaySchema = z
  .object({
    currency: z.literal("barter"),
    artikulId: z.number().int().positive(),
    count: z.number().int().positive(),
  })
  .strict();

const bundlePaySchema = z
  .object({
    currency: z.literal("bundle"),
    gold: goldCoinsSchema,
    barter: z
      .array(
        z
          .object({
            artikulId: z.number().int().positive(),
            count: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine((pay, context) => {
    if (pay.gold === 0 && pay.barter.length < 2) {
      context.addIssue({
        code: "custom",
        message: "bundle pay without gold must have at least two barter costs",
      });
    }
    const seen = new Set<number>();
    for (const cost of pay.barter) {
      if (seen.has(cost.artikulId)) {
        context.addIssue({
          code: "custom",
          message: `bundle pay has duplicate barter artikulId ${cost.artikulId}`,
        });
      }
      seen.add(cost.artikulId);
    }
  });

const rankRequireSchema = z
  .object({
    type: z.literal("RANK"),
    min: z.number().int().nonnegative(),
  })
  .strict();

const reputationRequireSchema = z
  .object({
    type: z.literal("REPUTATION"),
    objectId: z.number().int().positive(),
    min: z.number().int().positive(),
  })
  .strict();

const levelRequireSchema = z
  .object({
    type: z.literal("LEVEL"),
    min: z.number().int().positive(),
  })
  .strict();

const requirePredSchema = z.discriminatedUnion("type", [
  rankRequireSchema,
  reputationRequireSchema,
  levelRequireSchema,
]);

export const storeLotDocumentSchema = z
  .object({
    areaId: z.string().min(1),
    lotId: z.number().int().positive(),
    artikulId: z.number().int().positive(),
    typeId: z.number().int(),
    price: goldCoinsSchema,
    ord: z.number().int(),
    pay: z.discriminatedUnion("currency", [
      goldPaySchema,
      diamondPaySchema,
      barterPaySchema,
      bundlePaySchema,
    ]),
    requires: z
      .union([
        z.object({ all: z.array(requirePredSchema).min(1) }).strict(),
        z.object({ any: z.array(requirePredSchema).min(1) }).strict(),
      ])
      .optional(),
  })
  .strict();

export const storeTypesSchema = z.array(storeTypeDocumentSchema);
export const storeLotsSchema = z.array(storeLotDocumentSchema);
