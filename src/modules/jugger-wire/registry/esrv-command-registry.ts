import type { CombatPort } from "../../combat/ports/combat-port.ts";
import type { FightWireMapper } from "../application/fight-wire-mapper.ts";
import { EsrvPollCommand } from "../commands/esrv/esrv-poll-command.ts";
import { FightExitEncoder } from "../commands/esrv/fight-exit-encoder.ts";

export class EsrvCommandRegistry {
  static readonly requiredKeys = ["fight-exit", "poll"] as const;

  readonly poll: EsrvPollCommand;
  readonly fightExit: FightExitEncoder;

  constructor(poll: EsrvPollCommand, fightExit: FightExitEncoder) {
    if (poll.key === fightExit.key) {
      throw new Error(`Duplicate esrv command key ${poll.key}`);
    }
    const actual = [poll.key, fightExit.key].sort();
    const expected = [...EsrvCommandRegistry.requiredKeys].sort();
    if (actual.join("|") !== expected.join("|")) {
      throw new Error(`esrv registry keys [${actual.join(", ")}] must be [${expected.join(", ")}]`);
    }
    this.poll = poll;
    this.fightExit = fightExit;
  }

  static create(combat: CombatPort, fightWire: FightWireMapper): EsrvCommandRegistry {
    return new EsrvCommandRegistry(new EsrvPollCommand(combat), new FightExitEncoder(fightWire));
  }

  keys(): readonly string[] {
    return [this.fightExit.key, this.poll.key].sort();
  }
}
