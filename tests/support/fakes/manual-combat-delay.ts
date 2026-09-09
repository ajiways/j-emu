import type {
  CombatDelay,
  CombatDelayJob,
} from "../../../src/modules/combat/ports/combat-delay.ts";

export class ManualCombatDelay implements CombatDelay {
  private jobs: CombatDelayJob[] = [];

  schedule(job: CombatDelayJob): void {
    if (!job.token) throw new Error("Combat delay token is required");
    if (!(job.dueAt instanceof Date) || !Number.isFinite(job.dueAt.getTime())) {
      throw new Error("Combat delay dueAt must be a valid timestamp");
    }
    this.jobs.push(job);
  }

  cancel(token: string): void {
    if (!token) throw new Error("Combat delay token is required");
    this.jobs = this.jobs.filter((job) => job.token !== token);
  }

  async fireDue(now: Date): Promise<void> {
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
      throw new Error("Combat delay now must be a valid timestamp");
    }
    const due = this.jobs
      .filter((job) => job.dueAt.getTime() <= now.getTime())
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
    const dueSet = new Set(due);
    this.jobs = this.jobs.filter((job) => !dueSet.has(job));
    for (const job of due) await job.run();
  }
}
