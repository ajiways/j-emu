import path from "node:path";
import { describe, expect, it } from "vitest";
import { ContentValidator } from "../../../src/modules/content/application/content-validator.ts";
import type { ContentBundle } from "../../../src/modules/content/domain/content-document.ts";
import { loadContentBundleFile } from "../../../src/modules/content/infrastructure/load-content-bundle-file.ts";
import { parseContentBundle } from "../../../src/modules/content/domain/parse-content-bundle.ts";

const playable = loadContentBundleFile(path.resolve(process.cwd(), "content/playable-slice.json"));

describe("ContentValidator", () => {
  it("accepts the playable-slice bundle", () => {
    const validated = new ContentValidator().validate(playable);
    expect(validated.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(validated.entries.length).toBeGreaterThan(4);
  });

  it("rejects a spawn id outside the area map-hunt range", () => {
    const spawn = playable.huntSpawns[0];
    if (!spawn) throw new Error("playable bundle has no hunt spawns");
    const bundle: ContentBundle = {
      ...playable,
      huntSpawns: [{ ...spawn, id: 1 }],
    };
    expect(() => new ContentValidator().validate(bundle)).toThrow(/outside map hunt range/);
  });

  it("rejects a spawn that points at a missing bot", () => {
    const bundle: ContentBundle = {
      ...playable,
      huntSpawns: playable.huntSpawns.map((spawn) => ({ ...spawn, botId: 999 })),
    };
    expect(() => new ContentValidator().validate(bundle)).toThrow(/missing bot 999/);
  });

  it("rejects an artifact skill missing from the skill catalog", () => {
    const artifact = playable.artifacts[0];
    if (!artifact) throw new Error("playable bundle has no artifacts");
    const bundle: ContentBundle = {
      ...playable,
      artifacts: [
        { ...artifact, skills: [...artifact.skills, { id: "NOPE", value: 1, flags: 0 }] },
      ],
    };
    expect(() => new ContentValidator().validate(bundle)).toThrow(/missing skill NOPE/);
  });
});

describe("parseContentBundle", () => {
  it("rejects an unknown schema version", () => {
    expect(() => parseContentBundle({ ...playable, schemaVersion: "v0" })).toThrow();
  });

  it("rejects a missing wire asset", () => {
    const artifact = playable.artifacts[0];
    if (!artifact) throw new Error("playable bundle has no artifacts");
    expect(() =>
      parseContentBundle({
        ...playable,
        artifacts: [{ ...artifact, picture: "" }],
      }),
    ).toThrow();
  });

  it("rejects an artifact missing bag economy fields", () => {
    const artifact = playable.artifacts[0];
    if (!artifact) throw new Error("playable bundle has no artifacts");
    expect(() =>
      parseContentBundle({
        ...playable,
        artifacts: [
          {
            id: artifact.id,
            title: artifact.title,
            picture: artifact.picture,
            typeId: artifact.typeId,
            kindId: artifact.kindId,
            slotMask: artifact.slotMask,
            weight: artifact.weight,
            levelMin: artifact.levelMin,
            levelMax: artifact.levelMax,
            gender: artifact.gender,
            skills: artifact.skills,
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects an area without region_map", () => {
    const area = playable.areas[0];
    if (!area) throw new Error("playable bundle has no areas");
    expect(() =>
      parseContentBundle({
        ...playable,
        areas: [{ ...area, regionMap: "" }],
      }),
    ).toThrow();
  });
});
