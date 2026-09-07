import type { FightCommand } from "../../../combat/ports/combat-port.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import { requireFightObject } from "./fproxy-frame.ts";
import type { FproxyCommand } from "./fproxy-command.ts";

export class FproxyCastSpellCommand implements FproxyCommand {
  static readonly key = "castSpell";
  readonly key = FproxyCastSpellCommand.key;

  constructor(
    private readonly meleeSourceIds: Readonly<{
      left: number;
      center: number;
      right: number;
    }>,
  ) {}

  decode(frame: unknown): FightCommand {
    const record = requireFightObject(frame);
    if (record["rc"] !== "castSpell") {
      throw new ProtocolError(203, `Fight command ${String(record["rc"])} is unsupported`);
    }
    const sequence = record["sq"];
    if (typeof sequence !== "number" && typeof sequence !== "string") {
      throw new ProtocolError(203, "Fight command requires sq");
    }
    if (record["srcType"] !== 1) {
      throw new ProtocolError(203, `Fight source type ${String(record["srcType"])} is unsupported`);
    }
    const sourceId = record["srcId"];
    if (sourceId === this.meleeSourceIds.left) {
      return { kind: "strike", side: "left", sequence };
    }
    if (sourceId === this.meleeSourceIds.center) {
      return { kind: "strike", side: "center", sequence };
    }
    if (sourceId === this.meleeSourceIds.right) {
      return { kind: "strike", side: "right", sequence };
    }
    throw new ProtocolError(203, `Fight source id ${String(sourceId)} is unsupported`);
  }
}
