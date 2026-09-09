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

const artifactActionSchema = z
  .object({
    code: z.string().min(1),
    param1: z.number().int().positive(),
    param2: z.number().int().nonnegative(),
    dispose: z.union([z.literal(0), z.literal(1)]),
    title: z.string().min(1),
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
    artifact_actions: z.record(z.string().min(1), artifactActionSchema),
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
    sk: z.string().min(1),
    body: z.string(),
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
  })
  .strict();

const areaLinkSchema = z
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
    areaLinks: z.array(areaLinkSchema),
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
