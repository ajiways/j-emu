import type { FightCommand } from "../../../combat/ports/combat-port.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import { requireFightObject } from "./fproxy-frame.ts";
import type { FproxyCommand } from "./fproxy-command.ts";

export class FproxyLeaveFightCommand implements FproxyCommand {
  static readonly key = "leaveFight";
  readonly key = FproxyLeaveFightCommand.key;

  decode(frame: unknown): FightCommand {
    const record = requireFightObject(frame);
    if (record["rc"] !== "leaveFight") {
      throw new ProtocolError(203, `Fight command ${String(record["rc"])} is unsupported`);
    }
    const sequence = record["sq"];
    if (typeof sequence !== "number" && typeof sequence !== "string") {
      throw new ProtocolError(203, "Fight command requires sq");
    }
    return { kind: "leave", sequence };
  }
}
