import fs from "node:fs";
import path from "node:path";
import { decodeAmf3 } from "../../src/modules/jugger-wire/amf/amf3.ts";
import type { DungeonDocument } from "../../src/modules/content/domain/content-dungeon.ts";
import { dungeonFromJson } from "./dungeon-from-json.ts";
import { buildDungeonsManifest, type DungeonsManifest } from "./dungeons-manifest.ts";
import { instancesFromAmf } from "./instance-from-amf.ts";
import { digestOf, fileRecord, type SourceFileRecord } from "./pub1-bots-manifest.ts";

export type DecodeDungeonsResult = Readonly<{
  dungeons: readonly DungeonDocument[];
  dungeonsManifest: DungeonsManifest;
}>;

export function decodeDungeons(input: {
  pub1Dir: string;
  dungeonsDir: string;
}): DecodeDungeonsResult {
  if (!input.pub1Dir) throw new Error("PUB1_DIR is required");
  if (!input.dungeonsDir) throw new Error("dungeons directory is required");
  const amfPath = path.join(input.pub1Dir, "images/locale/ru/amf/instance.amf");
  if (!fs.existsSync(amfPath)) throw new Error(`instance.amf does not exist: ${amfPath}`);
  if (!fs.existsSync(input.dungeonsDir)) {
    throw new Error(`dungeons directory does not exist: ${input.dungeonsDir}`);
  }
  const amfBytes = fs.readFileSync(amfPath);
  const catalog = instancesFromAmf(decodeAmf(amfBytes, "instance.amf"));
  const files: SourceFileRecord[] = [fileRecord("images/locale/ru/amf/instance.amf", amfBytes)];
  const dungeons: DungeonDocument[] = [];
  const seen = new Set<number>();
  const names = fs
    .readdirSync(input.dungeonsDir)
    .filter((name) => name.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));
  if (names.length < 1) throw new Error("dungeons directory has no JSON fixtures");
  for (const name of names) {
    const filePath = path.join(input.dungeonsDir, name);
    const bytes = fs.readFileSync(filePath);
    files.push(fileRecord(`dungeons/${name}`, bytes));
    const dungeon = dungeonFromJson(parseJson(bytes, filePath), name);
    if (seen.has(dungeon.artikulId)) throw new Error(`Duplicate dungeon ${dungeon.artikulId}`);
    seen.add(dungeon.artikulId);
    const chrome = catalog.get(dungeon.artikulId);
    if (!chrome) throw new Error(`dungeon ${dungeon.artikulId} is missing from instance.amf`);
    if (chrome.title !== dungeon.title) {
      throw new Error(
        `dungeon ${dungeon.artikulId} title ${dungeon.title} does not match instance.amf ${chrome.title}`,
      );
    }
    dungeons.push(dungeon);
  }
  dungeons.sort((left, right) => left.artikulId - right.artikulId);
  return {
    dungeons,
    dungeonsManifest: buildDungeonsManifest({
      files,
      keys: dungeons.map((row) => ({ key: String(row.artikulId), digest: digestOf(row) })),
    }),
  };
}

export function outputDigest(result: DecodeDungeonsResult): string {
  return result.dungeonsManifest.corpusDigest;
}

function parseJson(bytes: Buffer, filePath: string): unknown {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`File is not valid JSON: ${filePath}`, { cause: error });
  }
}

function decodeAmf(bytes: Buffer, name: string): unknown {
  try {
    return decodeAmf3(bytes);
  } catch (error) {
    throw new Error(`${name} is not valid AMF3`, { cause: error });
  }
}
