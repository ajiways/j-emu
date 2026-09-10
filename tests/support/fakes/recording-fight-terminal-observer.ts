import type {
  FightFinishedNotice,
  FightTerminalObserver,
} from "../../../src/modules/combat/ports/fight-terminal-observer.ts";

export class RecordingFightTerminalObserver implements FightTerminalObserver {
  readonly notices: FightFinishedNotice[] = [];

  async afterFinished(notice: FightFinishedNotice): Promise<void> {
    this.notices.push(notice);
  }
}
