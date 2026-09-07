import type { CombatPort, FightExit } from "../../../combat/ports/combat-port.ts";

export class EsrvPollCommand {
  static readonly key = "poll";
  readonly key: string = EsrvPollCommand.key;

  constructor(private readonly combat: CombatPort) {}

  handle(accountId: number): Promise<FightExit | null> {
    return this.combat.takeExit(accountId);
  }
}
