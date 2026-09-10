import {
  bitsFromFlags,
  FLAG_JOIN_CONFIRM,
  FLAG_KILL_ALL,
  partyFlagSet,
} from "../modules/party/domain/party-flags.ts";
import { optionalPartyText } from "../modules/party/domain/party-optional-text.ts";
import { PartyDeniedError } from "../modules/party/domain/party-denied-error.ts";
import type {
  PartyCreateInput,
  PartySettingsPatch,
} from "../modules/party/application/party-service.ts";
import type { PartyRecord } from "../modules/party/domain/party-record.ts";
import type { ObjectActionEnvelope } from "../modules/jugger-wire/commands/oa/object-action-envelope.ts";

export function partyFields(envelope: ObjectActionEnvelope): Readonly<Record<string, unknown>> {
  return {
    ...(envelope.form ?? {}),
    ...(envelope.input ?? {}),
    ...(envelope.root ?? {}),
  };
}

export function requiredNick(
  fields: Readonly<Record<string, unknown>>,
  error = "укажите ник",
): string {
  const raw = fields["nick"];
  const nick = raw === undefined || raw === null ? "" : String(raw).trim();
  if (!nick) throw new PartyDeniedError(error);
  return nick;
}

export function requiredPartyId(fields: Readonly<Record<string, unknown>>): number {
  const raw = fields["party"] !== undefined ? fields["party"] : fields["party_id"];
  const parsed = Number(raw === undefined || raw === null ? 0 : raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new PartyDeniedError("группа не найдена");
  }
  return parsed;
}

export function optionalPartyId(fields: Readonly<Record<string, unknown>>): number {
  const raw = fields["party"];
  if (raw === undefined || raw === null || raw === "") return 0;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return 0;
  return parsed;
}

export function partyCreateInput(fields: Readonly<Record<string, unknown>>): PartyCreateInput {
  return {
    flags: bitsFromFlags(fields),
    isSearch: partyFlagSet(fields["is_search"]) ? 1 : 0,
    password: optionalPartyText(fields["password"], ""),
    instanceArtikulId: optionalPartyText(fields["instance_artikul_id"], "0"),
    botArtikulId: optionalPartyText(fields["bot_artikul_id"], "0"),
    type: optionalPartyText(fields["type"], "0"),
  };
}

export function partySettingsPatch(
  fields: Readonly<Record<string, unknown>>,
  current: PartyRecord,
): PartySettingsPatch {
  const patch: {
    lootRules?: string;
    noChat?: number;
    password?: string;
    isSearch?: number;
    instanceArtikulId?: string;
    botArtikulId?: string;
    type?: string;
    flags?: number;
  } = {};
  if (fields["loot_rules"] != null) patch.lootRules = String(fields["loot_rules"]);
  if (fields["no_chat"] != null) patch.noChat = partyFlagSet(fields["no_chat"]) ? 1 : 0;
  if (fields["empty_password"] != null && partyFlagSet(fields["empty_password"])) {
    patch.password = "";
  } else if (fields["password"] != null) {
    patch.password = String(fields["password"]);
  }
  if (fields["is_search"] != null) patch.isSearch = partyFlagSet(fields["is_search"]) ? 1 : 0;
  if (fields["instance_artikul_id"] != null) {
    patch.instanceArtikulId = String(fields["instance_artikul_id"]);
  }
  if (fields["bot_artikul_id"] != null) patch.botArtikulId = String(fields["bot_artikul_id"]);
  if (fields["type"] != null) patch.type = String(fields["type"]);
  if (fields["kill_all"] != null || fields["join_confirm"] != null || fields["flags"] != null) {
    patch.flags = bitsFromFlags({
      kill_all:
        fields["kill_all"] !== undefined
          ? fields["kill_all"]
          : (current.flags & FLAG_KILL_ALL) !== 0,
      join_confirm:
        fields["join_confirm"] !== undefined
          ? fields["join_confirm"]
          : (current.flags & FLAG_JOIN_CONFIRM) !== 0,
      flags: fields["flags"],
    });
  }
  return patch;
}

export function searchPage(fields: Readonly<Record<string, unknown>>): number {
  if (fields["page"] === undefined || fields["page"] === null || fields["page"] === "") return 1;
  const parsed = Number(fields["page"]);
  if (!Number.isInteger(parsed) || parsed < 1) throw new PartyDeniedError("page invalid");
  return parsed;
}
