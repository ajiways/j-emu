import { z } from "zod";
import { PLAYABLE_SLICE_SCHEMA_VERSION, type ContentBundle } from "./content-document.ts";
import {
  appearanceDocumentSchema,
  bootstrapChromeDocumentSchema,
  commonConfDocumentSchema,
  hudDefaultsDocumentSchema,
  levelBoundaryDocumentSchema,
  skillDocumentSchema,
  welcomeMessageDocumentSchema,
} from "./parse-bootstrap-content.ts";

const flag = z.union([z.literal(0), z.literal(1)]);

const artifactSkillSchema = z
  .object({
    id: z.string().min(1),
    value: z.number().int(),
    flags: z.number().int().nonnegative(),
  })
  .strict();

const artifactSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(1),
    picture: z.string().min(1),
    typeId: z.string().min(1),
    kindId: z.number().int().nonnegative(),
    slotMask: z.number().int().nonnegative(),
    weight: z.number().int().nonnegative(),
    levelMin: z.number().int().nonnegative(),
    levelMax: z.number().int().nonnegative(),
    gender: z.number().int().nonnegative(),
    priceMinor: z.number().int().nonnegative(),
    flags: z.number().int().nonnegative(),
    bagStack: z.number().int().positive(),
    skills: z.array(artifactSkillSchema),
  })
  .strict();

const huntLookSchema = z
  .object({
    nick: z.string().min(1),
    swf: z.string().min(1),
    scale: z.number().int().positive(),
    fps: z.number().int().positive(),
    speed: z.number().int().nonnegative(),
    avatar: z.string().min(1),
    kind: z.number().int().nonnegative(),
    hideOnMap: flag,
  })
  .strict();

const botSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(1),
    level: z.number().int().positive(),
    maxHp: z.number().int().positive(),
    strength: z.number().int().nonnegative(),
    hunt: huntLookSchema,
  })
  .strict();

const areaSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
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
  })
  .strict();

const huntSpawnSchema = z
  .object({
    id: z.number().int().positive().max(2_147_483_647),
    areaId: z.string().min(1),
    botId: z.number().int().positive(),
    x: z.number().finite(),
    y: z.number().finite(),
    huntMask: z.string().min(1),
  })
  .strict();

const bundleSchema = z
  .object({
    schemaVersion: z.literal(PLAYABLE_SLICE_SCHEMA_VERSION),
    artifacts: z.array(artifactSchema),
    bots: z.array(botSchema),
    areas: z.array(areaSchema),
    huntSpawns: z.array(huntSpawnSchema),
    skills: z.array(skillDocumentSchema).min(1),
    levels: z.array(levelBoundaryDocumentSchema).min(1),
    appearances: z.array(appearanceDocumentSchema).min(1),
    hudDefaults: hudDefaultsDocumentSchema,
    chrome: bootstrapChromeDocumentSchema,
    commonConf: commonConfDocumentSchema,
    welcomeMessage: welcomeMessageDocumentSchema,
  })
  .strict();

export function parseContentBundle(value: unknown): ContentBundle {
  return bundleSchema.parse(value);
}
