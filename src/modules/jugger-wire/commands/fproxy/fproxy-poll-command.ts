import type { FightCommand } from "../../../combat/ports/combat-port.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { FproxyCommand } from "./fproxy-command.ts";

export class FproxyPollCommand implements FproxyCommand {
  static readonly key = "poll";
  readonly key = FproxyPollCommand.key;

  decode(frame: unknown): FightCommand {
    if (frame === null) return { kind: "poll" };
    throw new ProtocolError(203, "Fight command poll is unsupported");
  }
}
