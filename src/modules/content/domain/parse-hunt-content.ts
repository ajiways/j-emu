import { z } from "zod";

const huntPointSchema = z.object({ x: z.number().finite(), y: z.number().finite() }).strict();

const huntRouteStopSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    waitMin: z.number().int().nonnegative(),
    waitMax: z.number().int().nonnegative(),
  })
  .strict()
  .refine((stop) => stop.waitMin <= stop.waitMax, {
    message: "route wait max is below min",
  });

export const huntSpawnDocumentSchema = z
  .object({
    id: z.number().int().positive().max(2_147_483_647),
    areaId: z.string().min(1),
    botId: z.number().int().positive(),
    x: z.number().finite(),
    y: z.number().finite(),
    huntMask: z.string().min(1),
    waitMin: z.number().int().nonnegative(),
    waitMax: z.number().int().nonnegative(),
    respawnTimeMin: z.number().int().nonnegative(),
    respawnTimeMax: z.number().int().nonnegative(),
    zone: z.array(huntPointSchema),
    route: z.array(huntRouteStopSchema),
  })
  .strict()
  .superRefine((spawn, ctx) => {
    if (spawn.waitMax < spawn.waitMin) {
      ctx.addIssue({
        code: "custom",
        message: `hunt_spawn ${spawn.id} wait max is below min`,
      });
    }
    if (spawn.respawnTimeMax < spawn.respawnTimeMin) {
      ctx.addIssue({
        code: "custom",
        message: `hunt_spawn ${spawn.id} respawn max is below min`,
      });
    }
    if (spawn.zone.length > 0 && spawn.zone.length < 3) {
      ctx.addIssue({
        code: "custom",
        message: `hunt_spawn ${spawn.id} zone must be empty or have at least 3 points`,
      });
    }
    if (spawn.route.length === 1) {
      ctx.addIssue({
        code: "custom",
        message: `hunt_spawn ${spawn.id} route must be empty or have at least 2 stops`,
      });
    }
    if (spawn.zone.length >= 3 && spawn.route.length >= 2) {
      ctx.addIssue({
        code: "custom",
        message: `hunt_spawn ${spawn.id} cannot author both a route and a zone`,
      });
    }
  });

export const huntSpawnsSchema = z.array(huntSpawnDocumentSchema);
