import type { OaCommand, OaEncodedResponse } from "../commands/oa/oa-command.ts";
import { oaRegistryKey, type ObjectActionEnvelope } from "../commands/oa/object-action-envelope.ts";

export class OaCommandRegistry {
  static readonly requiredKeys = [
    "common|init",
    "common|init2",
    "common|object:ATTACK_BOT",
    "user|bag",
  ] as const;

  private readonly commands: ReadonlyMap<string, OaCommand>;

  constructor(commands: readonly OaCommand[]) {
    const map = new Map<string, OaCommand>();
    for (const command of commands) {
      if (!command.key) throw new Error("OA command key is required");
      if (map.has(command.key)) throw new Error(`Duplicate OA command key ${command.key}`);
      map.set(command.key, command);
    }
    const actual = [...map.keys()].sort();
    const expected = [...OaCommandRegistry.requiredKeys].sort();
    if (actual.join("|") !== expected.join("|")) {
      throw new Error(`OA registry keys [${actual.join(", ")}] must be [${expected.join(", ")}]`);
    }
    this.commands = map;
  }

  keys(): readonly string[] {
    return [...this.commands.keys()].sort();
  }

  async dispatch(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    const key = oaRegistryKey(envelope);
    const command = this.commands.get(key);
    if (!command) return unsupportedOaResponse(key);
    return command.execute(accountId, envelope);
  }
}

function unsupportedOaResponse(key: string): OaEncodedResponse {
  const match = /^common\|object:(.*)$/.exec(key);
  const error = match
    ? `common|object code ${match[1]} is not implemented`
    : `${key} is not implemented`;
  return { kind: "nested", value: { status: 203, error } };
}
