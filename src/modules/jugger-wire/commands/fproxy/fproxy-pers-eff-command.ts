import type { FightCommand } from "../../../combat/ports/combat-port.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import { requireFightObject } from "./fproxy-frame.ts";
import type { FproxyCommand } from "./fproxy-command.ts";

export class FproxyPersEffCommand implements FproxyCommand {
  static readonly key = "persEff";
  readonly key = FproxyPersEffCommand.key;

  decode(frame: unknown): FightCommand {
    const record = requireFightObject(frame);
    if (record["rc"] !== "persEff") {
      throw new ProtocolError(203, `Fight command ${String(record["rc"])} is unsupported`);
    }
    const sequence = record["sq"];
    if (typeof sequence !== "number" && typeof sequence !== "string") {
      throw new ProtocolError(203, "Fight command requires sq");
    }
    const persId = record["persId"];
    if (typeof persId !== "number" || !Number.isInteger(persId) || persId < 1) {
      throw new ProtocolError(203, "Fight persEff requires persId");
    }
    return { kind: "pers-effects", persId, sequence };
  }
}
