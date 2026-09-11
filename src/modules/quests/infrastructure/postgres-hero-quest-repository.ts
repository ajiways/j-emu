import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { HeroFact, HeroQuest, HeroQuestGoal } from "../domain/hero-quest.ts";
import type {
  HeroQuestGoalPatch,
  HeroQuestPatch,
  HeroQuestRepository,
  NewHeroQuest,
} from "../ports/hero-quest-repository.ts";
import { heroFacts, heroQuestGoals, heroQuests } from "./schema.ts";

export class PostgresHeroQuestRepository implements HeroQuestRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async lockHeroQuests(heroId: number): Promise<readonly HeroQuest[]> {
    requireHeroId(heroId);
    const rows = await this.database
      .session()
      .select()
      .from(heroQuests)
      .where(eq(heroQuests.heroId, heroId))
      .for("update");
    return rows.map(toHeroQuest);
  }

  async find(heroId: number, questKey: string): Promise<HeroQuest | null> {
    requireHeroId(heroId);
    requireKey(questKey);
    const rows = await this.database
      .session()
      .select()
      .from(heroQuests)
      .where(and(eq(heroQuests.heroId, heroId), eq(heroQuests.questKey, questKey)));
    if (rows.length > 1) throw new Error(`Multiple hero quests for ${questKey}`);
    const row = rows[0];
    return row ? toHeroQuest(row) : null;
  }

  async insert(row: NewHeroQuest): Promise<HeroQuest> {
    const inserted = await this.database
      .session()
      .insert(heroQuests)
      .values({
        heroId: row.heroId,
        questKey: row.questKey,
        bookId: row.bookId,
        status: "active",
        dialogStep: row.dialogStep,
        dialogCursor: row.dialogCursor,
        startedAt: row.startedAt,
        hiddenInJournal: row.hiddenInJournal,
      })
      .returning();
    const created = inserted[0];
    if (!created) throw new Error(`Hero quest ${row.questKey} insert did not return a row`);
    return toHeroQuest(created);
  }

  async update(heroId: number, questKey: string, patch: HeroQuestPatch): Promise<void> {
    requireHeroId(heroId);
    requireKey(questKey);
    const waiting = waitingColumns(patch);
    const result = await this.database
      .session()
      .update(heroQuests)
      .set({
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.dialogStep !== undefined ? { dialogStep: patch.dialogStep } : {}),
        ...(patch.dialogCursor !== undefined ? { dialogCursor: patch.dialogCursor } : {}),
        ...(patch.finishedAt !== undefined ? { finishedAt: patch.finishedAt } : {}),
        ...(patch.hiddenInJournal !== undefined ? { hiddenInJournal: patch.hiddenInJournal } : {}),
        ...waiting,
      })
      .where(and(eq(heroQuests.heroId, heroId), eq(heroQuests.questKey, questKey)))
      .returning({ id: heroQuests.id });
    if (result.length !== 1) {
      throw new Error(`Hero quest ${questKey} update must touch one row`);
    }
  }

  async delete(heroId: number, questKey: string): Promise<void> {
    requireHeroId(heroId);
    requireKey(questKey);
    await this.database
      .session()
      .delete(heroQuestGoals)
      .where(and(eq(heroQuestGoals.heroId, heroId), eq(heroQuestGoals.questKey, questKey)));
    const result = await this.database
      .session()
      .delete(heroQuests)
      .where(and(eq(heroQuests.heroId, heroId), eq(heroQuests.questKey, questKey)))
      .returning({ id: heroQuests.id });
    if (result.length !== 1) {
      throw new Error(`Hero quest ${questKey} delete must touch one row`);
    }
  }

  async hideInJournal(heroId: number, questKey: string): Promise<void> {
    requireHeroId(heroId);
    requireKey(questKey);
    const result = await this.database
      .session()
      .update(heroQuests)
      .set({ hiddenInJournal: 1 })
      .where(and(eq(heroQuests.heroId, heroId), eq(heroQuests.questKey, questKey)))
      .returning({ id: heroQuests.id });
    if (result.length !== 1) {
      throw new Error(`Hero quest ${questKey} hide must touch one row`);
    }
  }

  async goals(heroId: number, questKey: string): Promise<readonly HeroQuestGoal[]> {
    requireHeroId(heroId);
    requireKey(questKey);
    const rows = await this.database
      .session()
      .select()
      .from(heroQuestGoals)
      .where(and(eq(heroQuestGoals.heroId, heroId), eq(heroQuestGoals.questKey, questKey)));
    return rows.map(toGoal);
  }

  async upsertGoals(
    heroId: number,
    questKey: string,
    rows: readonly HeroQuestGoalPatch[],
  ): Promise<void> {
    requireHeroId(heroId);
    requireKey(questKey);
    if (rows.length === 0) return;
    await this.database
      .session()
      .insert(heroQuestGoals)
      .values(
        rows.map((row) => ({
          heroId,
          questKey,
          goalId: row.goalId,
          goalOrd: row.goalOrd,
          done: row.done,
          value: row.value,
        })),
      )
      .onConflictDoUpdate({
        target: [heroQuestGoals.heroId, heroQuestGoals.questKey, heroQuestGoals.goalId],
        set: {
          goalOrd: sql`excluded.goal_ord`,
          done: sql`excluded.done`,
          value: sql`excluded.value`,
        },
      });
  }

  async saveGoal(row: HeroQuestGoal): Promise<void> {
    await this.upsertGoals(row.heroId, row.questKey, [row]);
  }

  async deleteGoals(heroId: number, questKey: string): Promise<void> {
    requireHeroId(heroId);
    requireKey(questKey);
    await this.database
      .session()
      .delete(heroQuestGoals)
      .where(and(eq(heroQuestGoals.heroId, heroId), eq(heroQuestGoals.questKey, questKey)));
  }

  async facts(heroId: number): Promise<readonly HeroFact[]> {
    requireHeroId(heroId);
    const rows = await this.database
      .session()
      .select()
      .from(heroFacts)
      .where(eq(heroFacts.heroId, heroId));
    return rows.map((row) => ({ heroId: row.heroId, factId: row.factId, value: row.value }));
  }

  async setFact(heroId: number, factId: string, value: string): Promise<void> {
    requireHeroId(heroId);
    if (!factId) throw new Error("Fact id is required");
    await this.database
      .session()
      .insert(heroFacts)
      .values({ heroId, factId, value })
      .onConflictDoUpdate({
        target: [heroFacts.heroId, heroFacts.factId],
        set: { value: sql`excluded.value` },
      });
  }

  async clearFact(heroId: number, factId: string): Promise<void> {
    requireHeroId(heroId);
    if (!factId) throw new Error("Fact id is required");
    await this.database
      .session()
      .delete(heroFacts)
      .where(and(eq(heroFacts.heroId, heroId), eq(heroFacts.factId, factId)));
  }

  async waiting(heroId: number): Promise<HeroQuest | null> {
    requireHeroId(heroId);
    const rows = await this.database
      .session()
      .select()
      .from(heroQuests)
      .where(and(eq(heroQuests.heroId, heroId), isNotNull(heroQuests.waitingActionId)));
    if (rows.length > 1) throw new Error(`Hero ${heroId} has multiple waiting quests`);
    const row = rows[0];
    return row ? toHeroQuest(row) : null;
  }
}

function waitingColumns(patch: HeroQuestPatch): Record<string, unknown> {
  if (patch.waiting === undefined) return {};
  if (patch.waiting === null) {
    return {
      waitingActionId: null,
      waitingTitle: null,
      waitingDurationSec: null,
      waitingPopup: null,
      waitingStartedAt: null,
    };
  }
  return {
    waitingActionId: patch.waiting.actionId,
    waitingTitle: patch.waiting.title,
    waitingDurationSec: patch.waiting.durationSec,
    waitingPopup: patch.waiting.popup,
    waitingStartedAt: patch.waiting.startedAt,
  };
}

function toHeroQuest(row: typeof heroQuests.$inferSelect): HeroQuest {
  const waiting =
    row.waitingActionId === null
      ? null
      : {
          actionId: row.waitingActionId,
          title: requireText(row.waitingTitle, "waiting title"),
          durationSec: requireDuration(row.waitingDurationSec),
          popup: row.waitingPopup ?? "",
          startedAt: requireDate(row.waitingStartedAt, "waiting startedAt"),
        };
  return {
    id: row.id,
    heroId: row.heroId,
    questKey: row.questKey,
    bookId: row.bookId,
    status: row.status === "done" ? "done" : "active",
    dialogStep: row.dialogStep,
    dialogCursor: row.dialogCursor,
    waiting,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    hiddenInJournal: requireHidden(row.hiddenInJournal),
  };
}

function toGoal(row: typeof heroQuestGoals.$inferSelect): HeroQuestGoal {
  return {
    heroId: row.heroId,
    questKey: row.questKey,
    goalId: row.goalId,
    goalOrd: row.goalOrd,
    done: row.done === 1 ? 1 : 0,
    value: row.value,
  };
}

function requireHeroId(heroId: number): void {
  if (!Number.isInteger(heroId) || heroId < 1) throw new Error("Hero id is required");
}

function requireKey(questKey: string): void {
  if (!questKey) throw new Error("Quest key is required");
}

function requireText(value: string | null, label: string): string {
  if (value === null) throw new Error(`${label} is required`);
  return value;
}

function requireDuration(value: number | null): number {
  if (value === null || !Number.isInteger(value) || value < 0) {
    throw new Error("Waiting duration is required");
  }
  return value;
}

function requireDate(value: Date | null, label: string): Date {
  if (!value) throw new Error(`${label} is required`);
  return value;
}

function requireHidden(value: number): 0 | 1 {
  if (value === 0) return 0;
  if (value === 1) return 1;
  throw new Error("hidden_in_journal must be 0 or 1");
}
