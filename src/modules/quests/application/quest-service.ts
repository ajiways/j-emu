import type { Clock } from "../../../shared/kernel/clock.ts";
import type { QuestDocument } from "../../content/domain/content-quest.ts";
import { boardRow, npcInfoBlock, npcQuestsBlock } from "../domain/board-wire.ts";
import {
  advanceAfterPlayer,
  dialogViewForProgress,
  parkedFightStep,
  type DialogView,
} from "../domain/dialog-cursor.ts";
import type { HeroQuest, HeroQuestGoal } from "../domain/hero-quest.ts";
import { isDailyQuest, questExperienceGrant } from "../domain/daily-cycle-rules.ts";
import { currentGoal, goalsComplete } from "../domain/prior-gate.ts";
import { questBookSnapshot, type QuestBookSnapshot } from "../domain/quest-book-snapshot.ts";
import { QuestDeniedError } from "../domain/quest-denied-error.ts";
import { scriptEffects, type QuestScriptEffect } from "../domain/quest-script-effect.ts";
import type { QuestSignal } from "../domain/quest-signal.ts";
import { bumpMatchingGoal } from "../domain/bump-goal.ts";
import { hasQuestStartFight, startFightEffects } from "../domain/quest-start-fight.ts";
import {
  completeParkedAreaFight as completeParked,
  neededForHero,
  syncOwnedGoals,
} from "./quest-hero-progress.ts";
import { catchUpDailyCycle, hideFinishedDaily } from "./quest-daily-wipe.ts";
import type { QuestAnswerInput, QuestMutation } from "./quest-mutation.ts";
import { boardLinkForNpc } from "../domain/npc-board-link.ts";
import { questByPoint, requireNpc, requirePositive } from "./quest-lookup.ts";
import type { HeroQuestRepository } from "../ports/hero-quest-repository.ts";
import type { QuestCatalog } from "../ports/quest-catalog.ts";
import type { QuestLootNeeded } from "../ports/quest-loot-needed.ts";

const MAX_ACTIVE = 6;

export class QuestService implements QuestLootNeeded {
  constructor(
    private readonly catalog: QuestCatalog,
    private readonly progress: HeroQuestRepository,
    private readonly clock: Clock,
  ) {}

  async board(heroId: number, npcRef: number): Promise<QuestMutation> {
    await this.catchUp(heroId);
    const npc = await requireNpc(this.catalog, npcRef);
    return { effects: [], bookDirty: true, npcId: npc.id };
  }

  async boardRows(heroId: number, npcRef: number): Promise<ReturnType<typeof npcQuestsBlock>> {
    const npc = await requireNpc(this.catalog, npcRef);
    const quests = await this.catalog.questsForNpc(npc.id);
    const rows = [];
    for (const quest of quests) {
      const link = boardLinkForNpc(quest, npc.id);
      if (!link) continue;
      const progress = await this.progress.find(heroId, quest.key);
      const goals = progress ? await this.progress.goals(heroId, quest.key) : [];
      const row = boardRow(quest, progress, goals, link);
      if (row) rows.push(row);
    }
    return npcQuestsBlock(npc, rows);
  }

  async npcInfo(npcRef: number) {
    return npcInfoBlock(await requireNpc(this.catalog, npcRef));
  }

  async bookSnapshot(heroId: number, filterType: string): Promise<QuestBookSnapshot> {
    await this.catchUp(heroId);
    const quests = await this.catalog.allQuests();
    const progress = await this.progress.lockHeroQuests(heroId);
    const goalsByKey = new Map<string, readonly HeroQuestGoal[]>();
    for (const row of progress) {
      goalsByKey.set(row.questKey, await this.progress.goals(heroId, row.questKey));
    }
    return questBookSnapshot(filterType, quests, progress, goalsByKey);
  }

  async cancel(heroId: number, bookId: number): Promise<QuestMutation> {
    await this.catchUp(heroId);
    if (!Number.isInteger(bookId) || bookId < 1) {
      throw new QuestDeniedError("Нет такого задания");
    }
    const quests = await this.catalog.allQuests();
    const quest = quests.find((row) => row.bookId === bookId);
    if (!quest) throw new QuestDeniedError("Нет такого задания");
    const row = await this.progress.find(heroId, quest.key);
    if (!row || row.status !== "active") throw new QuestDeniedError("Задание не взято");
    await this.progress.delete(heroId, quest.key);
    return { effects: [], bookDirty: true, npcId: quest.npcId };
  }

  async hideJournal(heroId: number, bookId: number): Promise<QuestMutation> {
    await this.catchUp(heroId);
    await hideFinishedDaily(this.catalog, this.progress, heroId, bookId);
    return { effects: [], bookDirty: true, npcId: 0 };
  }

  async answer(heroId: number, input: QuestAnswerInput, heroLevel: number): Promise<QuestMutation> {
    await this.catchUp(heroId);
    const npc = await requireNpc(this.catalog, input.npcRef);
    const quest = await questByPoint(this.catalog, npc.id, input.pointId);
    const progress = await this.progress.find(heroId, quest.key);
    if (progress?.status === "done" && isDailyQuest(quest.flags) && input.answerId !== 0) {
      throw new QuestDeniedError("Задание уже выполнено");
    }
    const goals = progress ? await this.progress.goals(heroId, quest.key) : [];
    const view = dialogViewForProgress(quest, progress?.dialogStep ?? 0, goals);
    if (input.answerId === 0) {
      return { effects: [], bookDirty: true, npcId: npc.id, dialog: view, pointId: input.pointId };
    }
    const picked = view.answers.find((answer) => answer.id === input.answerId);
    if (!picked) throw new QuestDeniedError("Нет такого ответа");
    if (view.mode === "stub") {
      const talk = await this.recordSignal(heroId, { kind: "talk", npcId: npc.id });
      return { ...talk, npcId: npc.id };
    }
    if (view.mode === "reward") return this.turnIn(heroId, quest, progress, goals);
    return this.advanceDialog(heroId, quest, progress, view, picked.stepOrd, heroLevel, npc.id);
  }

  async recordSignal(heroId: number, signal: QuestSignal): Promise<QuestMutation> {
    const active = (await this.progress.lockHeroQuests(heroId)).filter(
      (row) => row.status === "active",
    );
    const effects: QuestScriptEffect[] = [];
    let bookDirty = false;
    let npcId = 0;
    for (const row of active) {
      const quest = await this.requireQuest(row.questKey);
      const goals = await this.progress.goals(heroId, quest.key);
      const bumped = bumpMatchingGoal(quest, goals, signal);
      if (!bumped) continue;
      await this.progress.saveGoal(bumped.goal);
      effects.push(...bumped.onFinish);
      bookDirty = true;
      npcId = quest.npcId;
    }
    return { effects, bookDirty, npcId };
  }

  async beginAreaAction(
    heroId: number,
    objectId: number,
    actionId: number,
  ): Promise<QuestMutation> {
    requirePositive(objectId, "AREA object id");
    requirePositive(actionId, "AREA action id");
    const active = (await this.progress.lockHeroQuests(heroId)).filter(
      (row) => row.status === "active",
    );
    for (const row of active) {
      const quest = await this.requireQuest(row.questKey);
      const goals = await this.progress.goals(heroId, quest.key);
      const current = currentGoal(quest, goals);
      if (!current || current.kind !== "area_action") continue;
      if (current.actionId !== actionId || current.objectId !== objectId) continue;
      const now = this.clock.now();
      await this.progress.update(heroId, quest.key, {
        waiting: {
          actionId,
          title: current.waitingTitle,
          durationSec: current.waitingDurationSec,
          popup: current.waitingPopup,
          startedAt: now,
        },
      });
      const start = Math.floor(now.getTime() / 1000);
      return {
        effects: [],
        bookDirty: true,
        npcId: quest.npcId,
        waiting: {
          title: current.waitingTitle,
          start,
          finish: start + current.waitingDurationSec,
          popup: current.waitingPopup,
        },
      };
    }
    throw new QuestDeniedError("Нечего осматривать");
  }

  async finishAreaAction(heroId: number): Promise<QuestMutation> {
    const waiting = await this.progress.waiting(heroId);
    if (!waiting || !waiting.waiting) throw new QuestDeniedError("Нечего завершать");
    const elapsed =
      Math.floor(this.clock.now().getTime() / 1000) -
      Math.floor(waiting.waiting.startedAt.getTime() / 1000);
    if (elapsed < waiting.waiting.durationSec) throw new QuestDeniedError("Ещё рано");
    const actionId = waiting.waiting.actionId;
    const popup = waiting.waiting.popup;
    await this.progress.update(heroId, waiting.questKey, { waiting: null });
    const quest = await this.requireQuest(waiting.questKey);
    const goals = await this.progress.goals(heroId, quest.key);
    const current = currentGoal(quest, goals);
    if (
      current?.kind === "area_action" &&
      current.actionId === actionId &&
      hasQuestStartFight(current.onFinish)
    ) {
      return {
        effects: startFightEffects(current.onFinish),
        bookDirty: true,
        npcId: quest.npcId,
        popup,
      };
    }
    const bumped = await this.recordSignal(heroId, { kind: "area_action", actionId });
    return { ...bumped, popup };
  }

  async completeParkedAreaFight(heroId: number): Promise<QuestMutation> {
    return completeParked(this.catalog, this.progress, heroId);
  }

  async needed(heroId: number, artikulId: number, ownedInBag: number): Promise<number | null> {
    return neededForHero(this.catalog, this.progress, heroId, artikulId, ownedInBag);
  }

  async npcId(npcRef: number): Promise<number> {
    return (await requireNpc(this.catalog, npcRef)).id;
  }

  private async advanceDialog(
    heroId: number,
    quest: QuestDocument,
    progress: HeroQuest | null,
    view: DialogView,
    stepOrd: number,
    heroLevel: number,
    npcId: number,
  ): Promise<QuestMutation> {
    const effects: QuestScriptEffect[] = [];
    if (!progress) {
      await this.accept(heroId, quest, heroLevel);
      effects.push(...scriptEffects(quest.scripts.onAccept));
    }
    const playerOrd = view.mode === "goal" ? stepOrd + 1 : stepOrd;
    if (view.mode === "goal") {
      const talk = await this.recordSignal(heroId, { kind: "talk", npcId });
      effects.push(...talk.effects);
      const player = quest.dialogSteps[playerOrd];
      if (player?.type === "player") effects.push(...scriptEffects(player.scripts));
    } else {
      const player = quest.dialogSteps[stepOrd];
      if (player?.type === "player") effects.push(...scriptEffects(player.scripts));
    }
    const latestGoals = await this.progress.goals(heroId, quest.key);
    const after = advanceAfterPlayer(quest.dialogSteps, playerOrd);
    const player = quest.dialogSteps[playerOrd];
    const next =
      player?.type === "player" && player.toFight === 1
        ? parkedFightStep(quest, playerOrd, goalsComplete(quest, latestGoals))
        : after;
    await this.progress.update(heroId, quest.key, {
      dialogStep: next,
      dialogCursor: String(next),
    });
    const dialog = dialogViewForProgress(quest, next, latestGoals);
    return {
      effects,
      bookDirty: true,
      npcId: quest.npcId,
      dialog,
      pointId: quest.pointId,
    };
  }

  private async turnIn(
    heroId: number,
    quest: QuestDocument,
    progress: HeroQuest | null,
    goals: readonly HeroQuestGoal[],
  ): Promise<QuestMutation> {
    if (!progress || progress.status !== "active") {
      throw new QuestDeniedError("Задание не взято");
    }
    if (!goalsComplete(quest, goals)) throw new QuestDeniedError("Задание ещё не выполнено");
    const reward = quest.dialogSteps.find((step) => step.type === "reward");
    const effects: QuestScriptEffect[] = [
      ...(reward && reward.type === "reward" ? scriptEffects(reward.scripts) : []),
      { type: "GRANT_AWARDS" },
    ];
    const finishedAt = this.clock.now();
    await this.progress.update(heroId, quest.key, { status: "done", finishedAt });
    const experienceGrant = questExperienceGrant(
      heroId,
      quest.key,
      quest.flags,
      quest.awardExp,
      finishedAt,
    );
    return {
      effects,
      bookDirty: true,
      npcId: quest.npcId,
      questKey: quest.key,
      finishedAt,
      ...(experienceGrant ? { experienceGrant } : {}),
    };
  }

  private async accept(
    heroId: number,
    quest: QuestDocument,
    heroLevel: number,
  ): Promise<HeroQuest> {
    if (heroLevel < quest.levelMin) {
      throw new QuestDeniedError(`С ${quest.levelMin} уровня!`);
    }
    if (quest.levelMax > 0 && heroLevel > quest.levelMax) {
      throw new QuestDeniedError("Слишком высокий уровень");
    }
    const existing = await this.progress.find(heroId, quest.key);
    if (existing?.status === "done" && isDailyQuest(quest.flags)) {
      throw new QuestDeniedError("Задание уже выполнено");
    }
    if (existing) return existing;
    const active = (await this.progress.lockHeroQuests(heroId)).filter(
      (row) => row.status === "active",
    );
    if (active.length >= MAX_ACTIVE) throw new QuestDeniedError("Слишком много заданий");
    const inserted = await this.progress.insert({
      heroId,
      questKey: quest.key,
      bookId: quest.bookId,
      dialogStep: 0,
      dialogCursor: "0",
      startedAt: this.clock.now(),
      hiddenInJournal: 0,
    });
    await this.progress.upsertGoals(
      heroId,
      quest.key,
      quest.goals.map((goal) => ({
        goalId: goal.id,
        goalOrd: goal.goalOrd,
        done: 0,
        value: 0,
      })),
    );
    return inserted;
  }

  async setFlag(heroId: number, flag: string, value: string): Promise<void> {
    if (!flag) throw new Error("Quest flag is required");
    const fact = await this.catalog.worldFact(flag);
    if (!fact) throw new Error(`World fact ${flag} is missing`);
    await this.progress.setFact(heroId, flag, value);
  }

  async clearFlag(heroId: number, flag: string): Promise<void> {
    if (!flag) throw new Error("Quest flag is required");
    await this.progress.clearFact(heroId, flag);
  }

  async authoredQuest(key: string): Promise<QuestDocument> {
    return this.requireQuest(key);
  }

  async syncOwned(heroId: number, counts: ReadonlyMap<number, number>): Promise<QuestMutation> {
    return syncOwnedGoals(this.catalog, this.progress, heroId, counts);
  }

  private async requireQuest(key: string): Promise<QuestDocument> {
    const quest = await this.catalog.quest(key);
    if (!quest) throw new Error(`Quest ${key} is missing from the catalog`);
    return quest;
  }

  private async catchUp(heroId: number): Promise<void> {
    await catchUpDailyCycle(this.catalog, this.progress, this.clock, heroId);
  }
}
