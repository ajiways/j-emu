import { z } from "zod";

const flag = z.union([z.literal(0), z.literal(1)]);

const roomPosSchema = z
  .object({
    areaId: z.string().min(1),
    x: z.number().int(),
    y: z.number().int(),
    title: z.string().min(1),
  })
  .strict();

const leaderGroupSchema = z
  .object({
    id: z.string().min(1),
    minLevel: z.string().min(1),
    maxLevel: z.string().min(1),
  })
  .strict();

export const battlegroundDocumentSchema = z
  .object({
    id: z.number().int().positive(),
    type: z.string().min(1),
    title: z.string().min(1),
    flags: z.number().int().nonnegative(),
    available: flag,
    queueLevel: z.string(),
    error: z.string(),
    playable: flag,
    instArtikulId: z.number().int().nonnegative(),
    levelMin: z.number().int().nonnegative(),
    levelMax: z.number().int().nonnegative(),
    returnAreaId: z.string(),
    westAreaId: z.string(),
    arenaAreaId: z.string(),
    eastAreaId: z.string(),
    inviteTtlSec: z.number().int().nonnegative(),
    banSec: z.number().int().nonnegative(),
    matchDurationSec: z.number().int().nonnegative(),
    maxScore: z.number().int().nonnegative(),
    pointsPerKill: z.number().int().nonnegative(),
    fightBg: z.string(),
    fightFlags: z.string(),
    mapPicture: z.string(),
    statsPicture: z.string(),
    description: z.string(),
    rules: z.string(),
    roomPos: z.array(roomPosSchema),
    leaderGroups: z.array(leaderGroupSchema),
  })
  .strict();

export const battlegroundsSchema = z.array(battlegroundDocumentSchema);
