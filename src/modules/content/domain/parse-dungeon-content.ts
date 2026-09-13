import { z } from "zod";

const dungeonEncounterSchema = z
  .object({
    botId: z.number().int().positive(),
    count: z.number().int().positive(),
  })
  .strict();

const dungeonRouteStopSchema = z
  .object({
    x: z.number().int(),
    y: z.number().int(),
    waitMin: z.number().int().nonnegative(),
    waitMax: z.number().int().nonnegative(),
  })
  .strict()
  .refine((stop) => stop.waitMax >= stop.waitMin, {
    message: "dungeon route wait max is below min",
  });

const dungeonZonePointSchema = z
  .object({
    x: z.number().int(),
    y: z.number().int(),
  })
  .strict();

const dungeonSpawnSchema = z
  .object({
    spawnKey: z.string().min(1),
    huntBotId: z.number().int().positive(),
    encounter: z.array(dungeonEncounterSchema).min(1),
    isBoss: z.boolean(),
    countsForClear: z.boolean(),
    huntMask: z.string().min(1),
    positionX: z.number().int(),
    positionY: z.number().int(),
    waitMin: z.number().int().nonnegative(),
    waitMax: z.number().int().nonnegative(),
    zone: z.array(dungeonZonePointSchema),
    route: z.array(dungeonRouteStopSchema),
  })
  .strict()
  .refine((spawn) => spawn.waitMax >= spawn.waitMin, {
    message: "dungeon spawn wait max is below min",
  })
  .refine((spawn) => spawn.route.length !== 1, {
    message: "dungeon spawn route must be empty or have at least 2 stops",
  })
  .refine((spawn) => spawn.zone.length === 0 || spawn.zone.length >= 3, {
    message: "dungeon spawn zone must be empty or have at least 3 points",
  })
  .refine((spawn) => !(spawn.zone.length >= 3 && spawn.route.length >= 2), {
    message: "dungeon spawn cannot author both a route and a zone",
  });

const dungeonClearSchema = z
  .object({
    coinArtikulId: z.number().int().positive(),
    coinMin: z.number().int().positive(),
    coinMax: z.number().int().positive(),
  })
  .strict()
  .refine((coins) => coins.coinMax >= coins.coinMin, {
    message: "dungeon clear coin_max is below coin_min",
  });

const dungeonLootSchema = z
  .object({
    bossBotId: z.number().int().positive().optional(),
    personalGuaranteed: z.array(z.number().int().positive()),
  })
  .strict()
  .superRefine((loot, ctx) => {
    if (new Set(loot.personalGuaranteed).size !== loot.personalGuaranteed.length) {
      ctx.addIssue({
        code: "custom",
        message: "dungeon personal_guaranteed has duplicate artikul ids",
      });
    }
  });

const dungeonAreaSchema = z
  .object({
    areaId: z.string().min(1),
    spawns: z.array(dungeonSpawnSchema).min(1),
  })
  .strict()
  .superRefine((area, ctx) => {
    const keys = new Set<string>();
    for (const spawn of area.spawns) {
      if (keys.has(spawn.spawnKey)) {
        ctx.addIssue({
          code: "custom",
          message: `dungeon area ${area.areaId} has duplicate spawn_key ${spawn.spawnKey}`,
        });
      }
      keys.add(spawn.spawnKey);
    }
  });

export const dungeonDocumentSchema = z
  .object({
    artikulId: z.number().int().positive(),
    title: z.string().min(1),
    startAreaId: z.string().min(1),
    parentAreaId: z.string().min(1),
    levelMin: z.number().int().positive(),
    durationSec: z.number().int().positive(),
    imgUrl: z.string().min(1),
    hasClear: z.boolean(),
    progressFinishValue: z.number().int().positive().optional(),
    clear: dungeonClearSchema.optional(),
    loot: dungeonLootSchema.optional(),
    areas: z.array(dungeonAreaSchema).min(1),
  })
  .strict()
  .superRefine((dungeon, ctx) => {
    const areaIds = dungeon.areas.map((area) => area.areaId);
    if (new Set(areaIds).size !== areaIds.length) {
      ctx.addIssue({ code: "custom", message: `dungeon ${dungeon.artikulId} has duplicate areas` });
    }
    if (!areaIds.includes(dungeon.startAreaId)) {
      ctx.addIssue({
        code: "custom",
        message: `dungeon ${dungeon.artikulId} start area is missing from areas`,
      });
    }
    if (dungeon.parentAreaId === dungeon.startAreaId) {
      ctx.addIssue({
        code: "custom",
        message: `dungeon ${dungeon.artikulId} parent area matches start area`,
      });
    }
    const clearable = dungeon.areas.some((area) =>
      area.spawns.some((spawn) => spawn.countsForClear),
    );
    if (dungeon.hasClear) {
      if (dungeon.progressFinishValue === undefined) {
        ctx.addIssue({
          code: "custom",
          message: `dungeon ${dungeon.artikulId} hasClear is missing progressFinishValue`,
        });
      }
      if (!clearable) {
        ctx.addIssue({
          code: "custom",
          message: `dungeon ${dungeon.artikulId} hasClear has no countsForClear spawn`,
        });
      }
    } else {
      if (dungeon.progressFinishValue !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: `dungeon ${dungeon.artikulId} hasClear is false but progressFinishValue is authored`,
        });
      }
      if (dungeon.clear !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: `dungeon ${dungeon.artikulId} hasClear is false but clear coins are authored`,
        });
      }
    }
  });

export const dungeonsSchema = z.array(dungeonDocumentSchema);
