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
    const sourceType = record["srcType"];
    const sourceId = record["srcId"];
    if (typeof sourceId !== "number" || !Number.isInteger(sourceId)) {
      throw new ProtocolError(203, "Fight source id is invalid");
    }
    if (sourceType === 2) return { kind: "pocket", itemId: sourceId, sequence };
    if (sourceType === 3) return { kind: "glove", spellId: sourceId, sequence };
    if (sourceType !== 1) {
      throw new ProtocolError(203, `Fight source type ${String(sourceType)} is unsupported`);
    }
    if (sourceId === this.meleeSourceIds.left) {
      return { kind: "strike", side: "left", sequence };
    }
    if (sourceId === this.meleeSourceIds.center) {
      return { kind: "strike", side: "center", sequence };
    }
    if (sourceId === this.meleeSourceIds.right) {
      return { kind: "strike", side: "right", sequence };
    }
    if (sourceId === 6) return { kind: "rage", sequence };
    if (sourceId === 7) {
      const targetId = record["targetId"];
      if (typeof targetId !== "number" || !Number.isInteger(targetId) || targetId < 1) {
        throw new ProtocolError(203, "Fight aggro requires targetId");
      }
      return { kind: "aggro", targetId, sequence };
    }
    throw new ProtocolError(203, `Fight source id ${String(sourceId)} is unsupported`);
  }
}
