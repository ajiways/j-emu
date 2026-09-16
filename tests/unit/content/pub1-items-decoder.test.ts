import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { encodeAmf3, type AmfValue } from "../../../src/modules/jugger-wire/amf/amf3.ts";
import { decodePub1Items } from "../../../scripts/content-decode/decode-pub1-items.ts";
import { artifactFromAmf } from "../../../scripts/content-decode/artifact-from-amf.ts";
import { bagStackFor } from "../../../scripts/content-decode/bag-stack-rules.ts";

describe("Pub1 item decoder", () => {
  it("maps filename id, gold price, level_max -1, and bagStack", () => {
    const { artifact } = artifactFromAmf(20, sampleRecord(20));
    expect(artifact.id).toBe(20);
    expect(artifact.priceMinor).toBe(100);
    expect(artifact.levelMax).toBe(0);
    expect(artifact.bagStack).toBe(1);
    expect(artifact.skills).toEqual([{ id: "STR", value: 6, flags: 0 }]);
    expect(artifact.fBody).toBe("");
  });

  it("maps Pub1 f_body and treats omitted overlay as empty string", () => {
    const withOverlay = sampleRecord(20);
    if (!withOverlay || typeof withOverlay !== "object" || Array.isArray(withOverlay)) {
      throw new Error("sample record must be an object");
    }
    withOverlay.f_body = "110_1#4097";
    expect(artifactFromAmf(20, withOverlay).artifact.fBody).toBe("110_1#4097");
    expect(artifactFromAmf(20, sampleRecord(20)).artifact.fBody).toBe("");
  });

  it("treats omitted skill_flags as AMF zero", () => {
    const record = sampleRecord(20);
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error("sample record must be an object");
    }
    const skills = record.artifact_skills;
    if (!skills || typeof skills !== "object" || Array.isArray(skills)) {
      throw new Error("sample skills must be an object");
    }
    const str = skills.STR;
    if (!str || typeof str !== "object" || Array.isArray(str)) {
      throw new Error("sample STR skill must be an object");
    }
    delete str.skill_flags;
    const { artifact } = artifactFromAmf(20, record);
    expect(artifact.skills).toEqual([{ id: "STR", value: 6, flags: 0 }]);
  });

  it("computes bagStack from the named seed formula", () => {
    expect(bagStackFor(100, 67108864)).toBe(99);
    expect(bagStackFor(10, 603979776)).toBe(999);
    expect(bagStackFor(0, 0)).toBe(9999);
  });

  it("fails the whole corpus on an unreadable AMF record", () => {
    const dir = makePub1([{ name: "artifact_artikul_1.amf", bytes: Buffer.from([0xff]) }]);
    expect(() => decodePub1Items({ pub1Dir: dir.pub1, weightsFile: dir.weights })).toThrow(
      /Unreadable AMF record/,
    );
  });

  it("fails on a duplicate artikul_id", () => {
    const bytes = encodeAmf3(sampleRecord(7));
    const dir = makePub1([
      { name: "artifact_artikul_7.amf", bytes },
      { name: "artifact_artikul_07.amf", bytes },
    ]);
    expect(() => decodePub1Items({ pub1Dir: dir.pub1, weightsFile: dir.weights })).toThrow(
      /Duplicate artikul_id 7/,
    );
  });

  it("fails on an unknown AMF filename", () => {
    const dir = makePub1([{ name: "artifact_artikul_x.amf", bytes: encodeAmf3(sampleRecord(1)) }]);
    expect(() => decodePub1Items({ pub1Dir: dir.pub1, weightsFile: dir.weights })).toThrow(
      /Unknown AMF filename/,
    );
  });

  it("fails when weights reference a missing artifact", () => {
    const dir = makePub1([{ name: "artifact_artikul_8.amf", bytes: encodeAmf3(sampleRecord(8)) }]);
    fs.writeFileSync(
      dir.weights,
      JSON.stringify({ note: "x", slot_weight_max: 100, weights: { "9": 1 } }),
    );
    expect(() => decodePub1Items({ pub1Dir: dir.pub1, weightsFile: dir.weights })).toThrow(
      /Artikul weights 9 is not in the Pub1 corpus/,
    );
  });

  it("applies authored weights and is stable for the same bytes", () => {
    const dir = makePub1([{ name: "artifact_artikul_8.amf", bytes: encodeAmf3(sampleRecord(8)) }]);
    fs.writeFileSync(
      dir.weights,
      JSON.stringify({ note: "x", slot_weight_max: 100, weights: { "8": 50 } }),
    );
    const first = decodePub1Items({ pub1Dir: dir.pub1, weightsFile: dir.weights });
    const second = decodePub1Items({ pub1Dir: dir.pub1, weightsFile: dir.weights });
    expect(first.artifacts[0]?.weight).toBe(50);
    expect(first.manifest.corpusDigest).toBe(second.manifest.corpusDigest);
    expect(first.outputDigest).toBe(second.outputDigest);
  });
});

function sampleRecord(id: number): AmfValue {
  return {
    id,
    title: "Probe",
    picture: "probe.png",
    type_id: "2",
    kind_id: "44",
    slot_mask: "32",
    weight: "0",
    level_min: "1",
    level_max: "-1",
    gender: "0",
    price: "1.00",
    flags: 0,
    flags_ext: "0",
    durability: "0",
    durability_max: "0",
    artifact_skills: {
      STR: {
        skill_id: "STR",
        value: "6",
        skill_flags: "0",
        title: "Сила",
        group_id: "1",
        order: "0",
        weight: "900",
        picture_small: "",
      },
    },
    artifact_actions: [],
    trend: "0",
    param1: "0",
    set: [],
    spells: [],
    spell: "",
  };
}

function makePub1(files: readonly { name: string; bytes: Buffer }[]): {
  pub1: string;
  weights: string;
  amfNames: string[];
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pub1-items-"));
  const amf = path.join(root, "images/locale/ru/amf");
  fs.mkdirSync(amf, { recursive: true });
  for (const file of files) fs.writeFileSync(path.join(amf, file.name), file.bytes);
  const weights = path.join(root, "weights.json");
  fs.writeFileSync(weights, JSON.stringify({ note: "x", slot_weight_max: 100, weights: {} }));
  return { pub1: root, weights, amfNames: fs.readdirSync(amf) };
}
