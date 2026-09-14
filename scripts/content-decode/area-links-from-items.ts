import type { AreaLinkDocument } from "../../src/modules/content/domain/content-playable-entities.ts";
import { isRecord, rejectUnknownKeys, requireInteger, requireString } from "./json-object-keys.ts";

const ITEM_KEYS = new Set([
  "id",
  "title",
  "picture",
  "description",
  "href",
  "direction",
  "flags",
  "confirm_question",
  "to_id",
  "quest_bot_artikul",
  "quest_counter_id",
  "quest_counter_max",
  "quest_counter_min",
]);

const HREF_KEYS = new Set(["object", "action", "form", "ref"]);
const COME_IN_FORM_KEYS = new Set(["code", "area_id"]);

export function areaLinksFromItems(
  fromAreaId: string,
  items: readonly unknown[],
  areaIds: ReadonlySet<string>,
): AreaLinkDocument[] {
  const links: AreaLinkDocument[] = [];
  const seen = new Set<number>();
  for (const [index, raw] of items.entries()) {
    const link = travelLink(fromAreaId, raw, index, areaIds);
    if (!link) continue;
    if (seen.has(link.itemId)) {
      throw new Error(`Duplicate area link ${fromAreaId}:${link.itemId}`);
    }
    seen.add(link.itemId);
    links.push(link);
  }
  return links;
}

function travelLink(
  fromAreaId: string,
  raw: unknown,
  index: number,
  areaIds: ReadonlySet<string>,
): AreaLinkDocument | null {
  const label = `area ${fromAreaId} items[${index}]`;
  if (!isRecord(raw)) throw new Error(`${label} must be an object`);
  rejectUnknownKeys(raw, ITEM_KEYS, label);
  const itemId = requireInteger(raw.id, `${label} id`);
  if (itemId < 0) throw new Error(`${label} id is invalid`);
  if (!isRecord(raw.href)) return null;
  rejectUnknownKeys(raw.href, HREF_KEYS, `${label} href`);
  if (raw.href.object !== "common" || raw.href.action !== "action") return null;
  if (!isRecord(raw.href.form)) return null;
  if (raw.href.form.code !== "COME_IN") return null;
  rejectUnknownKeys(raw.href.form, COME_IN_FORM_KEYS, `${label} href.form`);
  const toAreaId = String(requireInteger(raw.href.form.area_id, `${label} href.form.area_id`));
  if (!areaIds.has(toAreaId)) return null;
  const toId = raw.to_id === undefined ? toAreaId : requireString(raw.to_id, `${label} to_id`);
  if (toId !== toAreaId) throw new Error(`${label} to_id does not match COME_IN area_id`);
  const confirm = requireString(raw.confirm_question ?? "", `${label} confirm_question`);
  if (confirm !== "") throw new Error(`${label} confirm_question must be empty`);
  return {
    fromAreaId,
    itemId,
    toAreaId,
    title: requireString(raw.title ?? "", `${label} title`),
    picture: requireString(raw.picture ?? "", `${label} picture`),
    description: requireString(raw.description ?? "", `${label} description`),
    flags: requireInteger(raw.flags ?? 0, `${label} flags`),
    direction: requireInteger(raw.direction ?? 0, `${label} direction`),
    confirmQuestion: "",
    toId,
    href: {
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: Number(toAreaId) },
    },
  };
}
