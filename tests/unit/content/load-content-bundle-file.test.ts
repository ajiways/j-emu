import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";

const slicePath = path.resolve(process.cwd(), "content/playable-slice.json");

describe("loadContentBundleFile generated files", () => {
  it("loads artifacts from itemsFile when the bundle list is empty", () => {
    const raw = readSlice();
    const sample = sampleArtifact(raw);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "items-file-"));
    writeBundle(dir, { ...raw, artifacts: [], itemsFile: "items.json" }, [
      ["items.json", [sample]],
    ]);
    const loaded = loadContentBundleFile(path.join(dir, "bundle.json"));
    expect(loaded.artifacts.some((row) => row.id === sample.id)).toBe(true);
  });

  it("rejects the same artikul_id in both files", () => {
    const raw = readSlice();
    const sample = sampleArtifact(raw);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "items-conflict-"));
    writeBundle(dir, { ...raw, artifacts: [sample], itemsFile: "items.json" }, [
      ["items.json", [sample]],
    ]);
    expect(() => loadContentBundleFile(path.join(dir, "bundle.json"))).toThrow(
      /Duplicate artifact artikul_id/,
    );
  });

  it("loads bots from botsFile when the bundle list is empty", () => {
    const raw = readSlice();
    const sample = sampleBot(raw);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bots-file-"));
    const bundle: Record<string, unknown> = { ...raw, bots: [], botsFile: "bots.json" };
    delete bundle.botLootFile;
    delete bundle.botSpellBooksFile;
    writeBundle(dir, bundle, [["bots.json", [sample]]]);
    const loaded = loadContentBundleFile(path.join(dir, "bundle.json"));
    expect(loaded.bots.some((row) => row.id === sample.id)).toBe(true);
  });

  it("rejects the same bot id in both files", () => {
    const raw = readSlice();
    const sample = sampleBot(raw);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bots-conflict-"));
    const bundle: Record<string, unknown> = { ...raw, bots: [sample], botsFile: "bots.json" };
    delete bundle.botLootFile;
    delete bundle.botSpellBooksFile;
    writeBundle(dir, bundle, [["bots.json", [sample]]]);
    expect(() => loadContentBundleFile(path.join(dir, "bundle.json"))).toThrow(/Duplicate bot id/);
  });

  it("rejects the same area id in both files", () => {
    const raw = readSlice();
    const sample = sampleArea(raw);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "areas-conflict-"));
    const bundle: Record<string, unknown> = { ...raw, areas: [sample], areasFile: "areas.json" };
    writeBundle(dir, bundle, [["areas.json", [sample]]]);
    expect(() => loadContentBundleFile(path.join(dir, "bundle.json"))).toThrow(/Duplicate area id/);
  });

  it("rejects the same store lot in both files", () => {
    const raw = readSlice();
    const sample = sampleStoreLot(raw);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "store-conflict-"));
    const bundle: Record<string, unknown> = {
      ...raw,
      storeLots: [sample],
      storeLotsFile: "lots.json",
    };
    writeBundle(dir, bundle, [["lots.json", [sample]]]);
    expect(() => loadContentBundleFile(path.join(dir, "bundle.json"))).toThrow(
      /Duplicate store_lot/,
    );
  });
});

function readSlice(): Record<string, unknown> & {
  artifacts: Array<{ id: number }>;
  bots: Array<{ id: number }>;
  areas?: Array<{ id: string }>;
  areasFile?: unknown;
  storeLots?: Array<{ areaId: string; lotId: number }>;
  storeLotsFile?: unknown;
} {
  return JSON.parse(fs.readFileSync(slicePath, "utf8")) as Record<string, unknown> & {
    artifacts: Array<{ id: number }>;
    bots: Array<{ id: number }>;
    areas?: Array<{ id: string }>;
    areasFile?: unknown;
    storeLots?: Array<{ areaId: string; lotId: number }>;
    storeLotsFile?: unknown;
  };
}

function sampleArtifact(raw: { artifacts: Array<{ id: number }>; itemsFile?: unknown }): {
  id: number;
} {
  const fromBundle = raw.artifacts[0];
  if (fromBundle) return fromBundle;
  if (typeof raw.itemsFile !== "string") throw new Error("playable-slice has no artifacts");
  const items = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "content", raw.itemsFile), "utf8"),
  ) as Array<{ id: number }>;
  const row = items[0];
  if (!row) throw new Error("itemsFile has no artifacts");
  return row;
}

function sampleStoreLot(raw: {
  storeLots?: Array<{ areaId: string; lotId: number }>;
  storeLotsFile?: unknown;
}): { areaId: string; lotId: number } {
  const fromBundle = raw.storeLots?.[0];
  if (fromBundle) return fromBundle;
  if (typeof raw.storeLotsFile !== "string") throw new Error("playable-slice has no store lots");
  const lots = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "content", raw.storeLotsFile), "utf8"),
  ) as Array<{ areaId: string; lotId: number }>;
  const row = lots[0];
  if (!row) throw new Error("storeLotsFile has no lots");
  return row;
}

function sampleArea(raw: { areas?: Array<{ id: string }>; areasFile?: unknown }): { id: string } {
  const fromBundle = raw.areas?.[0];
  if (fromBundle) return fromBundle;
  if (typeof raw.areasFile !== "string") throw new Error("playable-slice has no areas");
  const areas = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "content", raw.areasFile), "utf8"),
  ) as Array<{ id: string }>;
  const row = areas[0];
  if (!row) throw new Error("areasFile has no areas");
  return row;
}

function sampleBot(raw: { bots: Array<{ id: number }>; botsFile?: unknown; itemsFile?: unknown }): {
  id: number;
} {
  const fromBundle = raw.bots[0];
  if (fromBundle) return fromBundle;
  if (typeof raw.botsFile !== "string") throw new Error("playable-slice has no bots");
  const bots = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "content", raw.botsFile), "utf8"),
  ) as Array<{ id: number }>;
  const row = bots[0];
  if (!row) throw new Error("botsFile has no bots");
  return row;
}

function writeBundle(
  dir: string,
  bundle: Record<string, unknown>,
  extras: ReadonlyArray<readonly [string, unknown]>,
): void {
  fs.copyFileSync(
    path.resolve(process.cwd(), "content/common-conf.json"),
    path.join(dir, "common-conf.json"),
  );
  if (typeof bundle.botsFile === "string") {
    const dest = path.join(dir, bundle.botsFile);
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, "[]\n");
  }
  if (typeof bundle.botLootFile === "string") {
    const dest = path.join(dir, bundle.botLootFile);
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, "[]\n");
  }
  if (typeof bundle.botSpellBooksFile === "string") {
    const dest = path.join(dir, bundle.botSpellBooksFile);
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, "[]\n");
  }
  if (typeof bundle.areasFile === "string") {
    const dest = path.join(dir, bundle.areasFile);
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, "[]\n");
  }
  if (typeof bundle.areaLinksFile === "string") {
    const dest = path.join(dir, bundle.areaLinksFile);
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, "[]\n");
  }
  if (typeof bundle.huntSpawnsFile === "string") {
    const dest = path.join(dir, bundle.huntSpawnsFile);
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, "[]\n");
  }
  for (const key of [
    "storeTypesFile",
    "storeLotsFile",
    "reputationTracksFile",
    "bonusesFile",
    "useScriptsFile",
  ] as const) {
    const relative = bundle[key];
    if (typeof relative !== "string") continue;
    const dest = path.join(dir, relative);
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, "[]\n");
  }
  if (typeof bundle.itemsFile === "string" && bundle.itemsFile !== "items.json") {
    const dest = path.join(dir, bundle.itemsFile);
    if (!fs.existsSync(dest)) {
      const sample = sampleArtifact(
        bundle as { artifacts: Array<{ id: number }>; itemsFile?: unknown },
      );
      fs.writeFileSync(dest, JSON.stringify([sample]));
    }
  }
  for (const [name, value] of extras) {
    fs.writeFileSync(path.join(dir, name), JSON.stringify(value));
  }
  fs.writeFileSync(path.join(dir, "bundle.json"), JSON.stringify(bundle));
}
