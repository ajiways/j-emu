import { z } from "zod";
import { PROFESSION_ID_MAX, PROFESSION_ID_MIN } from "../../catalog/domain/profession-ids.ts";

export const assistantTypeDocumentSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(1),
    description: z.string(),
    profession: z.number().int().min(PROFESSION_ID_MIN).max(PROFESSION_ID_MAX),
    level: z.number().int().positive(),
    quality: z.number().int().nonnegative(),
    nextArtikulId: z.number().int().nonnegative(),
    skillSum: z.number().int().positive(),
    price: z.number().int().nonnegative(),
    priceType: z.number().int().positive(),
    picture: z.string().min(1),
    restrictionsXml: z.string(),
    voodooEnergy: z.number().int().nonnegative(),
  })
  .strict();

export const farmResourceDocumentSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(1),
    typeId: z.number().int().nonnegative(),
    picture: z.string().min(1),
    swf: z.string(),
    quality: z.number().int().nonnegative(),
    profession: z.number().int().min(0).max(PROFESSION_ID_MAX),
    artifactArtikulId: z.number().int().positive(),
    masteryValue: z.number().int().nonnegative(),
    masteryMax: z.number().int().positive(),
    farmTime: z.number().int().positive(),
    staminaDrain: z.number().int().positive(),
  })
  .strict();

export const areaFarmDocumentSchema = z
  .object({
    areaId: z.string().min(1),
    huntSpotId: z.number().int().positive(),
    farmId: z.number().int().positive(),
    tactics: z.number().int().min(0).max(2),
    assistantMax: z.number().int().positive(),
    cntMax: z.number().int().positive(),
    cntCurrent: z.number().int().nonnegative(),
    cntCooldown: z.number().int().nonnegative(),
  })
  .strict();

export const assistantTypesSchema = z.array(assistantTypeDocumentSchema);
export const farmResourcesSchema = z.array(farmResourceDocumentSchema);
export const areaFarmsSchema = z.array(areaFarmDocumentSchema);
