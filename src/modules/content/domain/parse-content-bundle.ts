import { z } from "zod";
import { PLAYABLE_SLICE_SCHEMA_VERSION, type ContentBundle } from "./content-document.ts";

const artifactSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(1),
    picture: z.string().min(1),
    typeId: z.string().min(1),
    kindId: z.number().int().nonnegative(),
    slotMask: z.number().int().nonnegative(),
    weight: z.number().int().nonnegative(),
  })
  .strict();

const botSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(1),
    level: z.number().int().positive(),
    maxHp: z.number().int().positive(),
    strength: z.number().int().nonnegative(),
  })
  .strict();

const areaSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    map: z.string().min(1),
    fightBackground: z.string().min(1),
  })
  .strict();

const huntSpawnSchema = z
  .object({
    id: z.string().min(1),
    areaId: z.string().min(1),
    botId: z.number().int().positive(),
    x: z.number().finite(),
    y: z.number().finite(),
  })
  .strict();

const bundleSchema = z
  .object({
    schemaVersion: z.literal(PLAYABLE_SLICE_SCHEMA_VERSION),
    artifacts: z.array(artifactSchema),
    bots: z.array(botSchema),
    areas: z.array(areaSchema),
    huntSpawns: z.array(huntSpawnSchema),
  })
  .strict();

export function parseContentBundle(value: unknown): ContentBundle {
  return bundleSchema.parse(value);
}
