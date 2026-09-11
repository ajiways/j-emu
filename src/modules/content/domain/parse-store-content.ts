import { z } from "zod";

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
    amount: z.number().int().nonnegative(),
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

export const storeLotDocumentSchema = z
  .object({
    areaId: z.string().min(1),
    lotId: z.number().int().positive(),
    artikulId: z.number().int().positive(),
    typeId: z.number().int(),
    price: z.number().int().nonnegative(),
    ord: z.number().int(),
    pay: z.discriminatedUnion("currency", [goldPaySchema, diamondPaySchema, barterPaySchema]),
    requires: z
      .object({
        all: z.array(
          z.discriminatedUnion("type", [
            rankRequireSchema,
            reputationRequireSchema,
            levelRequireSchema,
          ]),
        ),
      })
      .strict()
      .optional(),
  })
  .strict();

export const storeTypesSchema = z.array(storeTypeDocumentSchema);
export const storeLotsSchema = z.array(storeLotDocumentSchema);
