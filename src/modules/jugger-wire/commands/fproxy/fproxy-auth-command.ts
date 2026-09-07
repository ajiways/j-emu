import type { FightCommand } from "../../../combat/ports/combat-port.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { FproxyCommand } from "./fproxy-command.ts";
import { requireFightObject } from "./fproxy-frame.ts";

export class FproxyAuthCommand implements FproxyCommand {
  static readonly key = "auth";
  readonly key = FproxyAuthCommand.key;

  decode(frame: unknown): FightCommand {
    const record = requireFightObject(frame);
    if (record["rc"] !== "auth") {
      throw new ProtocolError(203, `Fight command ${String(record["rc"])} is unsupported`);
    }
    const sequence = record["sq"];
    if (typeof sequence !== "number" && typeof sequence !== "string") {
      throw new ProtocolError(203, "Fight command requires sq");
    }
    const fightId = record["eid"];
    if (typeof fightId !== "number" && typeof fightId !== "string") {
      throw new ProtocolError(203, "Fight auth requires eid");
    }
    return { kind: "authenticate", fightId: String(fightId), sequence };
  }
}
