import fs from "node:fs";
import type {
  AreaDocument,
  AreaLinkDocument,
  HuntSpawnDocument,
} from "../../src/modules/content/domain/content-playable-entities.ts";
import {
  areaFromFixture,
  requireAreaPresentation,
  type FixtureAreaRow,
} from "./area-from-fixture.ts";
import { applyAreaOverlay } from "./apply-area-overlay.ts";
import { clearMissingParents } from "./atlas-parent-policy.ts";
import { areaLinksFromItems } from "./area-links-from-items.ts";
import {
  buildAreaLinksManifest,
  buildAreasManifest,
  buildHuntSpawnsManifest,
  type AreaLinksManifest,
  type AreasManifest,
  type HuntSpawnsManifest,
} from "./areas-manifest.ts";
import { huntSpawnsFromJson } from "./hunt-spawns-from-json.ts";
import { isRecord, rejectUnknownKeys } from "./json-object-keys.ts";
import { digestOf, fileRecord, type SourceFileRecord } from "./pub1-bots-manifest.ts";

export type DecodeAreasResult = Readonly<{
  areas: readonly AreaDocument[];
  areaLinks: readonly AreaLinkDocument[];
  huntSpawns: readonly HuntSpawnDocument[];
  areasManifest: AreasManifest;
  areaLinksManifest: AreaLinksManifest;
  huntSpawnsManifest: HuntSpawnsManifest;
}>;

export function decodeAreas(input: {
  radveiAreasFile: string;
  bgAreasFile: string;
  overlayFile: string;
  huntSpawnsFile: string;
  eventArtikulsFile: string;
}): DecodeAreasResult {
  const radveiBytes = readBytes(input.radveiAreasFile, "radvei-areas.json");
  const bgBytes = readBytes(input.bgAreasFile, "bg-raskop-areas.json");
  const overlayBytes = readBytes(input.overlayFile, "areas-overlay.json");
  const huntBytes = readBytes(input.huntSpawnsFile, "hunt-spawns.json");
  const eventBytes = readBytes(input.eventArtikulsFile, "hunt-event-artikuls.json");
  const files: SourceFileRecord[] = [
    fileRecord("radvei-areas.json", radveiBytes),
    fileRecord("bg-raskop-areas.json", bgBytes),
    fileRecord("areas-overlay.json", overlayBytes),
    fileRecord("hunt-spawns.json", huntBytes),
    fileRecord("hunt-event-artikuls.json", eventBytes),
  ];
  const rows = [
    ...areaRows(parseJson(radveiBytes, input.radveiAreasFile), ["generated_from", "note", "areas"]),
    ...areaRows(parseJson(bgBytes, input.bgAreasFile), ["note", "areas"]),
  ];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.area.id)) throw new Error(`Duplicate area ${row.area.id}`);
    seen.add(row.area.id);
  }
  const overlayed = applyAreaOverlay(
    rows.map((row) => row.area),
    parseJson(overlayBytes, input.overlayFile),
  );
  const areas = clearMissingParents(overlayed).map(requireAreaPresentation);
  const areaIds = new Set(areas.map((area) => area.id));
  const itemsById = new Map(rows.map((row) => [row.area.id, row.items]));
  const areaLinks = areas.flatMap((area) => {
    const items = itemsById.get(area.id);
    if (items === undefined) throw new Error(`area ${area.id} is missing fixture items`);
    return areaLinksFromItems(area.id, items, areaIds);
  });
  const huntSpawns = huntSpawnsFromJson(
    parseJson(huntBytes, input.huntSpawnsFile),
    areaIds,
    eventBotIds(parseJson(eventBytes, input.eventArtikulsFile)),
  );
  const areaKeys = areas.map((area) => ({ key: area.id, digest: digestOf(area) }));
  const linkKeys = areaLinks.map((link) => ({
    key: `${link.fromAreaId}:${link.itemId}`,
    digest: digestOf(link),
  }));
  const huntKeys = huntSpawns.map((spawn) => ({ key: String(spawn.id), digest: digestOf(spawn) }));
  const areasManifest = buildAreasManifest({ files, keys: areaKeys });
  return {
    areas,
    areaLinks,
    huntSpawns,
    areasManifest,
    areaLinksManifest: buildAreaLinksManifest({
      filesDigest: areasManifest.filesDigest,
      keys: linkKeys,
    }),
    huntSpawnsManifest: buildHuntSpawnsManifest({
      filesDigest: areasManifest.filesDigest,
      keys: huntKeys,
    }),
  };
}

function areaRows(raw: unknown, rootKeys: readonly string[]): FixtureAreaRow[] {
  if (!isRecord(raw)) throw new Error("areas file root must be an object");
  rejectUnknownKeys(raw, new Set(rootKeys), "areas file");
  if (!isRecord(raw.areas)) throw new Error("areas map must be an object");
  return Object.entries(raw.areas).map(([id, row]) => areaFromFixture(id, row));
}

function eventBotIds(raw: unknown): Set<number> {
  if (!isRecord(raw)) throw new Error("hunt-event-artikuls root must be an object");
  rejectUnknownKeys(
    raw,
    new Set(["generated_from", "note", "artikuls", "seen_on_areas"]),
    "hunt-event-artikuls",
  );
  if (!isRecord(raw.artikuls)) throw new Error("hunt-event-artikuls.artikuls must be an object");
  const ids = new Set<number>();
  for (const key of Object.keys(raw.artikuls)) {
    if (!/^[1-9][0-9]*$/.test(key)) throw new Error(`event artikul key ${key} is invalid`);
    ids.add(Number(key));
  }
  return ids;
}

function parseJson(bytes: Buffer, filePath: string): unknown {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`File is not valid JSON: ${filePath}`, { cause: error });
  }
}

function readBytes(filePath: string, label: string): Buffer {
  if (!filePath) throw new Error(`${label} path is required`);
  if (!fs.existsSync(filePath)) throw new Error(`${label} does not exist: ${filePath}`);
  return fs.readFileSync(filePath);
}

export function outputDigests(result: DecodeAreasResult): {
  areas: string;
  areaLinks: string;
  huntSpawns: string;
} {
  return {
    areas: result.areasManifest.corpusDigest,
    areaLinks: result.areaLinksManifest.corpusDigest,
    huntSpawns: result.huntSpawnsManifest.corpusDigest,
  };
}
