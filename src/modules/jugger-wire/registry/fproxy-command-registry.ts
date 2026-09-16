import type { FightCommand } from "../../combat/ports/combat-port.ts";
import { decodeAmf3 } from "../amf/amf3.ts";
import { decodeFrames } from "../amf/framing.ts";
import { ProtocolError } from "../application/protocol-error.ts";
import type { FproxyCommand } from "../commands/fproxy/fproxy-command.ts";
import { FproxyAuthCommand } from "../commands/fproxy/fproxy-auth-command.ts";
import { FproxyCastSpellCommand } from "../commands/fproxy/fproxy-cast-spell-command.ts";
import { FproxyLeaveFightCommand } from "../commands/fproxy/fproxy-leave-fight-command.ts";
import { FproxyPersEffCommand } from "../commands/fproxy/fproxy-pers-eff-command.ts";
import { FproxyPersInfoCommand } from "../commands/fproxy/fproxy-pers-info-command.ts";
import { FproxyPollCommand } from "../commands/fproxy/fproxy-poll-command.ts";
import { fproxyCommandKey } from "../commands/fproxy/fproxy-frame.ts";

export class FproxyCommandRegistry {
  static readonly requiredKeys = [
    "auth",
    "castSpell",
    "leaveFight",
    "persEff",
    "persInfo",
    "poll",
  ] as const;

  private readonly commands: ReadonlyMap<string, FproxyCommand>;

  constructor(commands: readonly FproxyCommand[]) {
    const map = new Map<string, FproxyCommand>();
    for (const command of commands) {
      if (!command.key) throw new Error("fproxy command key is required");
      if (map.has(command.key)) throw new Error(`Duplicate fproxy command key ${command.key}`);
      map.set(command.key, command);
    }
    const actual = [...map.keys()].sort();
    const expected = [...FproxyCommandRegistry.requiredKeys].sort();
    if (actual.join("|") !== expected.join("|")) {
      throw new Error(
        `fproxy registry keys [${actual.join(", ")}] must be [${expected.join(", ")}]`,
      );
    }
    this.commands = map;
  }

  static fromMeleeSourceIds(
    meleeSourceIds: Readonly<{ left: number; center: number; right: number }>,
  ): FproxyCommandRegistry {
    return new FproxyCommandRegistry([
      new FproxyAuthCommand(),
      new FproxyCastSpellCommand(meleeSourceIds),
      new FproxyLeaveFightCommand(),
      new FproxyPersEffCommand(),
      new FproxyPersInfoCommand(),
      new FproxyPollCommand(),
    ]);
  }

  keys(): readonly string[] {
    return [...this.commands.keys()].sort();
  }

  decodeHttpBody(body: unknown): FightCommand {
    if (!Buffer.isBuffer(body)) throw new ProtocolError(204, "Fight body must be binary");
    // Live handleFightCommand: empty HTTP and 1-byte AMF null/undefined are poll.
    if (body.length <= 1) return this.require("poll").decode(null);
    return this.decodePayload(body);
  }

  decodePayload(payload: Buffer): FightCommand {
    const frame = decodeFightRequest(payload);
    const key = fproxyCommandKey(frame);
    return this.require(key).decode(frame);
  }

  private require(key: string): FproxyCommand {
    const command = this.commands.get(key);
    if (!command) throw new ProtocolError(203, `Fight command ${key} is unsupported`);
    return command;
  }
}

function decodeFightRequest(payload: Buffer): unknown {
  try {
    const value = decodeAmf3(payload);
    if (value !== null && typeof value === "object") return value;
  } catch {
    // Live `decodeFightRequest`: length-prefixed first frame when bare AMF3 fails.
  }
  try {
    const first = decodeFrames(payload)[0];
    if (first !== undefined) return first;
  } catch {
    // Both framings failed.
  }
  throw new ProtocolError(204, "unrecognized fight request framing");
}
