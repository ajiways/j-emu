import type { AreaDocument } from "../../src/modules/content/domain/content-playable-entities.ts";
import {
  isRecord,
  rejectUnknownKeys,
  requireFlag,
  requireInteger,
  requireString,
} from "./json-object-keys.ts";

const OVERLAY_KEYS = new Set([
  "title",
  "parentId",
  "map",
  "fightBackground",
  "regionMap",
  "ftimeMax",
  "code",
  "context",
  "soundIntro",
  "soundBg",
  "instArtikulId",
  "haveTradeChannel",
  "haveKindChannel",
  "hideFinishedFights",
  "hideRunningFights",
  "noClanChat",
  "bgId",
]);

type AreaOverlayPatch = {
  -readonly [K in keyof AreaDocument]?: AreaDocument[K];
};

export function applyAreaOverlay(areas: readonly AreaDocument[], overlay: unknown): AreaDocument[] {
  const byId = overlayById(overlay);
  const merged = areas.map((area) => {
    const patch = byId.get(area.id);
    if (!patch) return area;
    byId.delete(area.id);
    return { ...area, ...patch, id: area.id };
  });
  const leftover = [...byId.keys()];
  if (leftover[0]) throw new Error(`overlay area ${leftover[0]} is not in the atlas`);
  return merged;
}

function overlayById(overlay: unknown): Map<string, AreaOverlayPatch> {
  if (!isRecord(overlay)) throw new Error("areas overlay must be an object");
  rejectUnknownKeys(overlay, new Set(["areas"]), "areas overlay");
  if (!isRecord(overlay.areas)) throw new Error("areas overlay.areas must be an object");
  const byId = new Map<string, AreaOverlayPatch>();
  for (const [id, raw] of Object.entries(overlay.areas)) {
    if (byId.has(id)) throw new Error(`Duplicate overlay area ${id}`);
    byId.set(id, overlayPatch(id, raw));
  }
  return byId;
}

function overlayPatch(id: string, raw: unknown): AreaOverlayPatch {
  if (!isRecord(raw)) throw new Error(`overlay area ${id} must be an object`);
  rejectUnknownKeys(raw, OVERLAY_KEYS, `overlay area ${id}`);
  const patch: AreaOverlayPatch = {};
  assignString(patch, "title", raw.title, id);
  assignString(patch, "parentId", raw.parentId, id);
  assignString(patch, "map", raw.map, id);
  assignString(patch, "fightBackground", raw.fightBackground, id);
  assignString(patch, "regionMap", raw.regionMap, id);
  assignString(patch, "code", raw.code, id);
  assignString(patch, "context", raw.context, id);
  assignString(patch, "soundIntro", raw.soundIntro, id);
  assignString(patch, "soundBg", raw.soundBg, id);
  assignString(patch, "bgId", raw.bgId, id);
  if (raw.ftimeMax !== undefined)
    patch.ftimeMax = requireInteger(raw.ftimeMax, `overlay area ${id} ftimeMax`);
  if (raw.instArtikulId !== undefined) {
    patch.instArtikulId = requireInteger(raw.instArtikulId, `overlay area ${id} instArtikulId`);
  }
  if (raw.haveTradeChannel !== undefined) {
    patch.haveTradeChannel = requireFlag(
      raw.haveTradeChannel,
      `overlay area ${id} haveTradeChannel`,
    );
  }
  if (raw.haveKindChannel !== undefined) {
    patch.haveKindChannel = requireFlag(raw.haveKindChannel, `overlay area ${id} haveKindChannel`);
  }
  if (raw.hideFinishedFights !== undefined) {
    patch.hideFinishedFights = requireFlag(
      raw.hideFinishedFights,
      `overlay area ${id} hideFinishedFights`,
    );
  }
  if (raw.hideRunningFights !== undefined) {
    patch.hideRunningFights = requireFlag(
      raw.hideRunningFights,
      `overlay area ${id} hideRunningFights`,
    );
  }
  if (raw.noClanChat !== undefined) {
    patch.noClanChat = requireFlag(raw.noClanChat, `overlay area ${id} noClanChat`);
  }
  return patch;
}

function assignString(
  patch: AreaOverlayPatch,
  key: keyof AreaDocument,
  value: unknown,
  id: string,
): void {
  if (value === undefined) return;
  (patch as Record<string, unknown>)[key] = requireString(value, `overlay area ${id} ${key}`);
}
