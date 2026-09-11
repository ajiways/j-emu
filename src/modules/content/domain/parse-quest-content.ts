import { z } from "zod";

const rosterEntrySchema = z
  .object({
    artikulId: z.number().int().positive(),
    count: z.number().int().positive(),
  })
  .strict();

const scriptOpSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("START_FIGHT"),
      mode: z.literal("quest"),
      enemies: z.array(rosterEntrySchema).min(1),
      allies: z.array(rosterEntrySchema).default([]),
      chatStart: z.string().default(""),
      chatWin: z.string().default(""),
      chatLose: z.string().default(""),
    })
    .strict(),
  z
    .object({
      type: z.literal("GRANT_ARTIKUL"),
      artikulId: z.number().int().positive(),
      count: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal("GRANT_PROFESSION"),
      professionId: z.number().int().min(1).max(16),
    })
    .strict(),
  z
    .object({
      type: z.literal("REMOVE_ARTIKUL"),
      artikulId: z.number().int().positive(),
      count: z.number().int().positive(),
    })
    .strict(),
  z.object({ type: z.literal("MSG"), text: z.string().min(1) }).strict(),
  z
    .object({
      type: z.literal("SET_FLAG"),
      flag: z.string().min(1),
      value: z.string().min(1),
    })
    .strict(),
  z.object({ type: z.literal("CLEAR_FLAG"), flag: z.string().min(1) }).strict(),
  z.object({ type: z.literal("BUMP_GOAL"), goal: z.string().min(1) }).strict(),
  z.object({ type: z.literal("COMPLETE_GOAL"), goal: z.string().min(1) }).strict(),
  z.object({ type: z.literal("GRANT_AWARDS") }).strict(),
]);

const goalKindSchema = z.enum([
  "talk",
  "kill",
  "loot",
  "buy",
  "equip",
  "deliver",
  "area_action",
  "win_fight",
]);

const goalArtikulSchema = z
  .object({
    role: z.enum(["kill", "buy", "equip", "loot", "deliver", "loot_mob"]),
    artikulId: z.number().int().positive(),
  })
  .strict();

const goalSchema = z
  .object({
    id: z.string().min(1),
    kind: goalKindSchema,
    title: z.string().min(1),
    goalOrd: z.number().int().positive(),
    limit: z.number().int().positive(),
    artikuls: z.array(goalArtikulSchema).default([]),
    actionId: z.number().int().nonnegative().default(0),
    objectId: z.number().int().nonnegative().default(0),
    waitingTitle: z.string().default(""),
    waitingDurationSec: z.number().int().nonnegative().default(0),
    waitingPopup: z.string().default(""),
    onFinish: z.array(scriptOpSchema).default([]),
  })
  .strict();

const dialogStepSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.enum(["npc", "note", "stage"]),
      text: z.string().min(1),
      id: z.string().default(""),
    })
    .strict(),
  z
    .object({
      type: z.literal("goal"),
      text: z.string().min(1),
      goal: z.string().min(1),
      id: z.string().default(""),
    })
    .strict(),
  z
    .object({
      type: z.literal("player"),
      text: z.string().min(1),
      id: z.string().min(1),
      next: z.string().default(""),
      toFight: z.union([z.literal(0), z.literal(1)]).default(0),
      scripts: z.array(scriptOpSchema).default([]),
    })
    .strict(),
  z
    .object({
      type: z.literal("reward"),
      text: z.string().default(""),
      answer: z.string().default("Сдать задание"),
      id: z.string().default(""),
      scripts: z.array(scriptOpSchema).default([]),
    })
    .strict(),
]);

const npcSchema = z
  .object({
    id: z.number().int().positive(),
    infoId: z.number().int().positive(),
    title: z.string().min(1),
    picture: z.string().min(1),
    description: z.string(),
    elsetext: z.string(),
    areaId: z.string().min(1),
    itemId: z.number().int().positive(),
  })
  .strict();

const questSchema = z
  .object({
    key: z.string().min(1),
    bookId: z.number().int().positive(),
    title: z.string().min(1),
    description: z.string(),
    awardDescription: z.string(),
    flags: z.number().int().nonnegative(),
    levelMin: z.number().int().positive(),
    levelMax: z.number().int().nonnegative(),
    npcId: z.number().int().positive(),
    pointId: z.number().int().positive(),
    boardOrd: z.number().int().positive(),
    welcomeOffer: z.string().min(1),
    welcomeActive: z.string().min(1),
    welcomeReady: z.string().min(1),
    awardExp: z.number().int().nonnegative(),
    awardMoneyMinor: z.number().int().nonnegative(),
    awardItems: z
      .array(
        z
          .object({
            artikulId: z.number().int().positive(),
            count: z.number().int().positive(),
          })
          .strict(),
      )
      .default([]),
    goals: z.array(goalSchema),
    dialogSteps: z.array(dialogStepSchema).min(1),
  })
  .strict();

const worldFactSchema = z
  .object({
    id: z.string().min(1),
    values: z.array(z.string()),
  })
  .strict();

export const npcsSchema = z.array(npcSchema);
export const questsSchema = z.array(questSchema);
export const worldFactsSchema = z.array(worldFactSchema);
