import { requirePresent } from "../../../shared/kernel/require-present.ts";
import type { CombatDelay, CombatDelayJob } from "../ports/combat-delay.ts";

export class SystemCombatDelay implements CombatDelay {
  private readonly handles = new Map<string, ReturnType<typeof setTimeout>[]>();

  schedule(job: CombatDelayJob): void {
    const token = requireToken(job.token);
    if (!(job.dueAt instanceof Date) || !Number.isFinite(job.dueAt.getTime())) {
      throw new Error("Combat delay dueAt must be a valid timestamp");
    }
    const run = requirePresent(job.run, "Combat delay job");
    const waitMs = Math.max(0, job.dueAt.getTime() - Date.now());
    const handle = setTimeout(() => {
      this.forget(token, handle);
      void run();
    }, waitMs);
    const bucket = this.handles.get(token);
    if (bucket) bucket.push(handle);
    else this.handles.set(token, [handle]);
  }

  cancel(token: string): void {
    const bucket = this.handles.get(requireToken(token));
    if (!bucket) return;
    for (const handle of bucket) clearTimeout(handle);
    this.handles.delete(token);
  }

  private forget(token: string, handle: ReturnType<typeof setTimeout>): void {
    const bucket = this.handles.get(token);
    if (!bucket) return;
    const next = bucket.filter((entry) => entry !== handle);
    if (next.length === 0) this.handles.delete(token);
    else this.handles.set(token, next);
  }
}

function requireToken(token: string): string {
  if (!token) throw new Error("Combat delay token is required");
  return token;
}
