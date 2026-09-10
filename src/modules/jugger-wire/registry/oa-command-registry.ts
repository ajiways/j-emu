import type { OaCommand, OaEncodedResponse } from "../commands/oa/oa-command.ts";
import { oaRegistryKey, type ObjectActionEnvelope } from "../commands/oa/object-action-envelope.ts";

export class OaCommandRegistry {
  static readonly requiredKeys = [
    "battlepass|list",
    "book|quest_list",
    "chat|conf",
    "common|conf",
    "common|init",
    "common|init2",
    "common|menu_link_status",
    "common|object:ATTACK_BOT",
    "common|object:DROP",
    "common|object:PUT_OFF",
    "common|object:PUT_ON",
    "common|object:SELL",
    "common|object:USE",
    "common|object:UPGRADE",
    "common|object:COME_IN",
    "common|object:RESURRECT",
    "common|exit",
    "companion|list_user_companions",
    "craft|user_recipes_list",
    "jail|list",
    "user|bag",
    "user|flash_message",
    "user|friendly_duel_accept",
    "user|friendly_duel_propose",
    "user|magic",
    "user|personal_details",
    "user|save_personal_details",
    "user|skills",
    "user|stats",
    "user|unitframe",
    "user|view",
    "store|list",
    "store|buy",
    "store|repair",
    "post|list",
    "post|list_sent",
    "post|send",
    "post|send_cod",
    "post|pick",
    "post|batch_pick",
    "post|delete",
    "post|retract",
    "post|read",
    "user|bag_order",
    "auction|lot",
    "auction|my_lot",
    "auction|my_bid",
    "auction|min_price",
    "auction|lot_add",
    "auction|bid",
    "auction|buyout",
    "auction|cancel",
    "auction|tenders",
    "auction|my_tenders",
    "auction|tender_add",
    "auction|tender_cancel",
    "auction|tender_sell",
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

  has(key: string): boolean {
    if (!key) throw new Error("OA command key is required");
    return this.commands.has(key);
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
