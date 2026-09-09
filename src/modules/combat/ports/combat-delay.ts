export type CombatDelayJob = Readonly<{
  token: string;
  dueAt: Date;
  run: () => void | Promise<void>;
}>;

export interface CombatDelay {
  schedule(job: CombatDelayJob): void;
  cancel(token: string): void;
}
