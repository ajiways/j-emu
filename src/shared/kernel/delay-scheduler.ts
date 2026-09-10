export type DelayJob = Readonly<{
  token: string;
  dueAt: Date;
  run: () => void | Promise<void>;
}>;

export interface DelayScheduler {
  schedule(job: DelayJob): void;
  cancel(token: string): void;
}
