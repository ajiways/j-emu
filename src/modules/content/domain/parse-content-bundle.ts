import { z } from "zod";
import { ARTIFACT_KIND_SET_BONUS } from "../../catalog/domain/artifact-kind.ts";
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
import { storeLotsSchema, storeTypesSchema } from "./parse-store-content.ts";
import { reputationTracksSchema } from "./parse-reputation-content.ts";
import { professionsSchema } from "./parse-profession-content.ts";
import {
  areaFarmsSchema,
  assistantTypesSchema,
  farmResourcesSchema,
} from "./parse-farm-content.ts";
import { craftRecipesSchema } from "./parse-craft-content.ts";
import { dungeonsSchema } from "./parse-dungeon-content.ts";
import { battlegroundsSchema } from "./parse-battleground-content.ts";
import { bonusDocumentSchema, useScriptDocumentSchema } from "./parse-use-content.ts";
import { huntSpawnsSchema } from "./parse-hunt-content.ts";
import { npcsSchema, questsSchema, worldFactsSchema } from "./parse-quest-content.ts";

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
    code: z.string(),
    param1: z.number().int().nonnegative(),
    param2: z.number().int().nonnegative(),
    dispose: z.union([z.literal(0), z.literal(1)]),
    title: z.string().min(1),
    bonusId: z.number().int().nonnegative().optional(),
    description: z.string().optional(),
  })
  .strict()
  .transform((action) => ({
    code: action.code,
    param1: action.param1,
    param2: action.param2,
    dispose: action.dispose,
    title: action.title,
    bonusId: action.bonusId === undefined ? 0 : action.bonusId,
    description: action.description === undefined ? "" : action.description,
  }));

const artifactSpellSkillSchema = z
  .object({
    skill_id: z.string().min(1),
    value: z.number(),
  })
  .strict();

const artifactSpellEffectSchema = z
  .object({
    kind: z.number().int().positive(),
    amount: z.union([z.number(), z.string()]).optional(),
    dmgType: z.number().int().nonnegative().optional(),
    charging: z.number().int().positive().optional(),
    capacity: z.number().int().positive().optional(),
    order: z.number().int().optional(),
    hidden: z.number().int().nonnegative().optional(),
    targetCount: z.number().int().positive().optional(),
    duration: z.number().int().nonnegative().optional(),
    forceSelfTargeting: z.boolean().optional(),
    realStartTime: z.boolean().optional(),
    skills: z.array(artifactSpellSkillSchema).optional(),
  })
  .strict();

const artifactSpellSchema = z
  .object({
    animData: z.string().min(1).optional(),
    groupId: z.number().int().positive().optional(),
    cooldown: z.number().int().nonnegative().optional(),
    endTurn: z.boolean().optional(),
    flags: z.union([z.string(), z.number()]).optional(),
    persRestr: z.record(z.string(), z.unknown()).optional(),
    targetRestr: z.record(z.string(), z.unknown()).optional(),
    triggers: z.unknown().optional(),
    onlyPvP: z.unknown().optional(),
    effects: z.array(artifactSpellEffectSchema).min(1),
  })
  .strict();

const artifactGloveSocketSchema = z
  .object({
    id: z.number().int().positive().optional(),
    cost: z.number().int().positive(),
    row: z.number().int().positive(),
    artikul_id0: z.number().int().positive(),
  })
  .strict();

const artifactSetSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(1),
    bonus1: z.number().int().nonnegative().optional(),
    bonus2: z.number().int().nonnegative().optional(),
    bonus3: z.number().int().nonnegative().optional(),
    bonus4: z.number().int().nonnegative().optional(),
    bonus5: z.number().int().nonnegative().optional(),
    bonus6: z.number().int().nonnegative().optional(),
    bonus7: z.number().int().nonnegative().optional(),
    bonus8: z.number().int().nonnegative().optional(),
    bonus9: z.number().int().nonnegative().optional(),
    avatar_man: z.string(),
    avatar_woman: z.string(),
  })
  .strict();

const artifactExtraSchema = z
  .object({
    spell: artifactSpellSchema.optional(),
    spells: z.array(artifactGloveSocketSchema).optional(),
    hits: z.array(z.number().int().min(1).max(3)).optional(),
    trend: z.number().int().min(0).max(3).optional(),
    set: artifactSetSchema.optional(),
    param1: z.number().int().nonnegative().optional(),
    flagsExt: z.number().int().nonnegative().optional(),
  })
  .strict()
  .transform((extra) => ({
    ...(extra.spell ? { spell: extra.spell } : {}),
    ...(extra.spells ? { spells: extra.spells } : {}),
    ...(extra.hits ? { hits: extra.hits } : {}),
    ...(extra.trend !== undefined ? { trend: extra.trend } : {}),
    ...(extra.set ? { set: extra.set } : {}),
    ...(extra.param1 !== undefined ? { param1: extra.param1 } : {}),
    ...(extra.flagsExt !== undefined ? { flagsExt: extra.flagsExt } : {}),
  }));

const artifactSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(1),
    picture: z.string(),
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
    durability: z.number().int().nonnegative(),
    durabilityMax: z.number().int().nonnegative(),
    skills: z.array(artifactSkillSchema),
    artifact_actions: z.record(z.string().min(1), artifactActionSchema),
    extra: artifactExtraSchema,
  })
  .strict()
  .refine((artifact) => artifact.durability <= artifact.durabilityMax, {
    message: "durability must be <= durabilityMax",
  })
  .refine(
    (artifact) => artifact.picture.length > 0 || artifact.kindId === ARTIFACT_KIND_SET_BONUS,
    {
      message: "picture is required except for kind 139",
    },
  );

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

const botLootEntrySchema = z
  .object({
    artikulId: z.number().int().positive(),
    dropWeight: z.number().int().nonnegative(),
    countMin: z.number().int().positive(),
    countMax: z.number().int().positive(),
  })
  .strict()
  .refine((entry) => entry.countMax >= entry.countMin, {
    message: "loot countMax must be >= countMin",
  });

const botSpellCardSchema = z
  .object({
    artikulId: z.number().int().positive(),
    slot: z.enum(["fight_start", "prefer", "turn_roulette", "never"]),
    weight: z.number().int().nonnegative(),
    maxCasts: z.number().int().positive().nullable(),
    gate: z.literal("self_hp_le").nullable(),
    hpPct: z.number().int().min(1).max(100).nullable(),
    spell: artifactSpellSchema,
  })
  .strict()
  .refine((card) => (card.gate === "self_hp_le") === (card.hpPct !== null), {
    message: "hpPct is required exactly when gate is self_hp_le",
  });

const botSpellBookSchema = z
  .object({
    nothingWeight: z.number().int().nonnegative(),
    spells: z.array(botSpellCardSchema),
  })
  .strict()
  .refine(
    (book) => new Set(book.spells.map((card) => card.artikulId)).size === book.spells.length,
    { message: "spellBook artikul ids must be unique" },
  );

const botSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(1),
    level: z.number().int().positive(),
    maxHp: z.number().int().positive(),
    strength: z.number().int().nonnegative(),
    hunt: huntLookSchema,
    baseExp: z.number().int().nonnegative(),
    moneyMin: z.number().nonnegative(),
    moneyMax: z.number().nonnegative(),
    lootDropCnt: z.number().int().nonnegative(),
    lootBonusChance: z.number().min(0).max(1),
    lootBonusMin: z.number().int().nonnegative(),
    lootBonusMax: z.number().int().nonnegative(),
    lootNothingWeight: z.number().int().nonnegative(),
    lootEntries: z.array(botLootEntrySchema),
    spellBook: botSpellBookSchema,
  })
  .strict()
  .refine((bot) => bot.moneyMax >= bot.moneyMin, { message: "moneyMax must be >= moneyMin" })
  .refine((bot) => bot.lootBonusMax >= bot.lootBonusMin, {
    message: "lootBonusMax must be >= lootBonusMin",
  })
  .refine(
    (bot) =>
      new Set(bot.lootEntries.map((entry) => entry.artikulId)).size === bot.lootEntries.length,
    { message: "lootEntries artikul ids must be unique" },
  );

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
    bgId: z.string(),
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

const bundleSchema = z
  .object({
    schemaVersion: z.literal(PLAYABLE_SLICE_SCHEMA_VERSION),
    artifacts: z.array(artifactSchema),
    bots: z.array(botSchema),
    areas: z.array(areaSchema),
    areaLinks: z.array(areaLinkSchema),
    huntSpawns: huntSpawnsSchema,
    dungeons: dungeonsSchema,
    battlegrounds: battlegroundsSchema,
    storeTypes: storeTypesSchema,
    storeLots: storeLotsSchema,
    reputationTracks: reputationTracksSchema,
    professions: professionsSchema,
    assistantTypes: assistantTypesSchema,
    farmResources: farmResourcesSchema,
    areaFarms: areaFarmsSchema,
    craftRecipes: craftRecipesSchema,
    npcs: npcsSchema,
    quests: questsSchema,
    worldFacts: worldFactsSchema,
    bonuses: z.array(bonusDocumentSchema),
    useScripts: z.array(useScriptDocumentSchema),
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
  return bundleSchema.parse(value) as ContentBundle;
}
