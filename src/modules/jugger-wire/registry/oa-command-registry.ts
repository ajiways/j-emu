import type { OaCommand, OaEncodedResponse } from "../commands/oa/oa-command.ts";
import { oaRegistryKey, type ObjectActionEnvelope } from "../commands/oa/object-action-envelope.ts";

export class OaCommandRegistry {
  static readonly requiredKeys = [
    "battlepass|list",
    "book|quest_list",
    "book|quest_cancel",
    "book|quest_delete",
    "book|bestiary_info",
    "book|instances",
    "chat|conf",
    "chat|add",
    "npc|quests",
    "npc|info",
    "npc|answer",
    "common|conf",
    "common|init",
    "common|init2",
    "common|menu_link_status",
    "common|object:ATTACK_BOT",
    "common|object:ATTACK",
    "common|object:DROP",
    "common|object:PUT_OFF",
    "common|object:PUT_ON",
    "common|object:SELL",
    "common|object:USE",
    "common|object:UPGRADE",
    "common|object:COME_IN",
    "common|object:AREA",
    "common|object:RESURRECT",
    "common|exit",
    "common|action_finish",
    "companion|list_user_companions",
    "craft|craft_items",
    "craft|recipe_add_favorite",
    "craft|recipe_remove_favorite",
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
    "user|professions",
    "user|stats",
    "user|unitframe",
    "user|view",
    "fight|finish",
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
    "arena|list",
    "arena|bg",
    "arena|bg_request",
    "arena|bg_running",
    "arena|bg_finished",
    "arena|great_fights",
    "arena|leader_rating",
    "arena|finished_fights",
    "arena|runned_fights",
    "trade|request",
    "trade|confirm",
    "trade|put",
    "trade|put_money",
    "trade|withdraw",
    "trade|session_ready",
    "trade|session_decline",
    "trade|session_confirm",
    "trade|decline",
    "party|create",
    "party|invite",
    "party|confirm_invite",
    "party|decline_invite",
    "party|kick",
    "party|leave",
    "party|disband",
    "party|change_leader",
    "party|save_settings",
    "party|search_list",
    "party|join",
    "party|confirm_join",
    "party|decline_join",
    "party|members",
    "party|settings",
    "party|bag",
    "party|give",
    "party|drop",
    "common|object:FIGHT_JOIN",
    "common|object:FIGHT_HELP",
    "assistant|info",
    "assistant|farm_info",
    "assistant|work",
    "assistant|repeat",
    "assistant|revoke",
    "assistant|save",
    "assistant|create",
    "assistant|upgrade",
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
