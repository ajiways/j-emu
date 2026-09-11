type HeroQuestStatus = "active" | "done";

export type HeroQuestWaiting = Readonly<{
  actionId: number;
  title: string;
  durationSec: number;
  popup: string;
  startedAt: Date;
}>;

export type HeroQuest = Readonly<{
  id: number;
  heroId: number;
  questKey: string;
  bookId: number;
  status: HeroQuestStatus;
  dialogStep: number;
  dialogCursor: string;
  waiting: HeroQuestWaiting | null;
  startedAt: Date;
  finishedAt: Date | null;
  hiddenInJournal: 0 | 1;
}>;

export type HeroQuestGoal = Readonly<{
  heroId: number;
  questKey: string;
  goalId: string;
  goalOrd: number;
  done: 0 | 1;
  value: number;
}>;

export type HeroFact = Readonly<{
  heroId: number;
  factId: string;
  value: string;
}>;
