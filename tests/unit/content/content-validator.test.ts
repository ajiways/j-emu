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
    expect(validated.entries).toHaveLength(4);
  });

  it("rejects a spawn that points at a missing bot", () => {
    const bundle: ContentBundle = {
      ...playable,
      huntSpawns: playable.huntSpawns.map((spawn) => ({ ...spawn, botId: 999 })),
    };
    expect(() => new ContentValidator().validate(bundle)).toThrow(/missing bot 999/);
  });

  it("rejects duplicate artifact ids", () => {
    const artifact = playable.artifacts[0];
    if (!artifact) throw new Error("playable bundle has no artifacts");
    const bundle: ContentBundle = {
      ...playable,
      artifacts: [artifact, { ...artifact }],
    };
    expect(() => new ContentValidator().validate(bundle)).toThrow(/duplicate artifact id/);
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
});
