import fs from "node:fs";
import { z } from "zod";

const location = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("bag") }),
  z.object({ kind: z.literal("pocket"), position: z.number().int().positive() }),
  z.object({ kind: z.literal("equipment"), slot: z.number().int().positive() }),
]);

const schema = z.object({
  heroCreation: z.object({
    exp: z.literal(1),
    areaId: z.string().min(1),
    moneyMinor: z.number().int().nonnegative(),
    moneyGoldMinor: z.number().int().nonnegative(),
    kind: z.number().int().positive(),
    gender: z.number().int().positive(),
    language: z.string().min(1),
    body: z.string().min(1),
    sk: z.number().int().nonnegative(),
    honor: z.number().int().nonnegative(),
    tutorialInfo: z.object({
      finished_first_fight: z.string().min(1),
      tutorial2: z.string().min(1),
    }),
    skills: z
      .array(
        z.object({
          id: z.string().min(1),
          value: z.number().int().nonnegative(),
        }),
      )
      .min(1),
  }),
  regen: z.object({
    k: z.literal(250),
    provenance: z.literal("legacy behavior / empirical"),
  }),
  starterItems: z
    .array(
      z.object({
        artifactId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        location,
      }),
    )
    .min(1),
  bootstrap: z.object({
    bagCapacity: z.number().int().positive(),
    pocketCapacity: z.number().int().positive(),
    chat: z.object({
      protocol: z.string().min(1),
      key: z.string().min(1),
      chat_server: z.string().min(1),
    }),
    menuLinks: z.record(z.string(), z.string()),
  }),
  combat: z.object({
    strPerDamagePoint: z.literal(10),
    damageSpread: z.literal(0.15),
    turnTimeoutSeconds: z.number().int().positive(),
    meleeBotCounterMs: z.number().int().positive(),
    turnGrantDelayMs: z.number().int().positive(),
    damageProvenance: z.literal("legacy behavior"),
    meleeSourceIds: z.object({
      left: z.number().int().positive(),
      center: z.number().int().positive(),
      right: z.number().int().positive(),
    }),
  }),
  fightWire: z.object({
    heroSkill: z.number().int().positive(),
    heroBody: z.string().min(1),
    autoFight: z.number().int().nonnegative(),
    canLeave: z.union([z.literal(0), z.literal(1)]),
    companionEnabled: z.union([z.literal(0), z.literal(1)]),
    isPvp: z.union([z.literal(0), z.literal(1)]),
    instanceId: z.string().min(1),
    type: z.string().min(1),
    isSlaughter: z.boolean(),
    flags: z.string().min(1),
  }),
});

export type GamePolicy = z.infer<typeof schema>;

export function loadGamePolicy(filePath: string): GamePolicy {
  if (!fs.existsSync(filePath)) throw new Error(`Game policy file does not exist: ${filePath}`);
  let decoded: unknown;
  try {
    decoded = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Game policy is not valid JSON: ${filePath}`, { cause: error });
  }
  return schema.parse(decoded);
}
