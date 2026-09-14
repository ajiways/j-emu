import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decodeAreas } from "../../../scripts/content-decode/decode-areas.ts";

describe("areas decoder", () => {
  it("fails the whole corpus on an unknown area field", () => {
    const dir = makeSources({});
    const radvei = JSON.parse(fs.readFileSync(dir.input.radveiAreasFile, "utf8")) as {
      areas: Record<string, { mystery?: number }>;
    };
    radvei.areas["503"]!.mystery = 1;
    fs.writeFileSync(dir.input.radveiAreasFile, JSON.stringify(radvei));
    expect(() => decodeAreas(dir.input)).toThrow(/unknown field mystery/);
  });

  it("keeps dump-proven 503 presentation after overlay", () => {
    const dir = makeSources({});
    const first = decodeAreas(dir.input);
    const second = decodeAreas(dir.input);
    const village = first.areas.find((area) => area.id === "503");
    expect(village).toMatchObject({
      title: "Горное поселение",
      map: "forestvillage.swf",
      context: "4",
      hideRunningFights: 1,
      parentId: "",
    });
    expect(first.areaLinks.map((link) => link.toAreaId)).toEqual(["504"]);
    expect(first.huntSpawns.map((spawn) => spawn.id)).toEqual([50310]);
    expect(first.areasManifest.corpusDigest).toBe(second.areasManifest.corpusDigest);
  });

  it("fails when a spawn uses an event artikul", () => {
    const dir = makeSources({});
    fs.writeFileSync(
      dir.input.eventArtikulsFile,
      JSON.stringify({
        generated_from: "test",
        note: "test",
        artikuls: { "2": {} },
        seen_on_areas: {},
      }),
    );
    expect(() => decodeAreas(dir.input)).toThrow(/event artikul/);
  });

  it("fails on a duplicate area id", () => {
    const dir = makeSources({});
    fs.writeFileSync(
      dir.input.bgAreasFile,
      JSON.stringify({
        note: "test",
        areas: { "503": sampleArea("503", "Горное поселение", "forestvillage.swf", "498") },
      }),
    );
    expect(() => decodeAreas(dir.input)).toThrow(/Duplicate area 503/);
  });
});

function makeSources(input: { overlay?: unknown }): {
  input: {
    radveiAreasFile: string;
    bgAreasFile: string;
    overlayFile: string;
    huntSpawnsFile: string;
    eventArtikulsFile: string;
  };
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "areas-"));
  const radveiAreasFile = path.join(root, "radvei.json");
  const bgAreasFile = path.join(root, "bg.json");
  const overlayFile = path.join(root, "overlay.json");
  const huntSpawnsFile = path.join(root, "hunts.json");
  const eventArtikulsFile = path.join(root, "events.json");
  fs.writeFileSync(
    radveiAreasFile,
    JSON.stringify({
      generated_from: "test",
      note: "test",
      areas: {
        "503": sampleArea("503", "Горное поселение", "forestvillage.swf", "498"),
        "504": sampleArea("504", "Деревенская лавка", "forestvillage.swf", "503", "store"),
      },
    }),
  );
  fs.writeFileSync(bgAreasFile, JSON.stringify({ note: "test", areas: {} }));
  fs.writeFileSync(
    overlayFile,
    JSON.stringify(
      input.overlay ?? {
        areas: {
          "503": {
            context: "4",
            soundIntro: "Ambience_village.mp3",
            soundBg: "Ambience_village.mp3",
            hideRunningFights: 1,
          },
        },
      },
    ),
  );
  fs.writeFileSync(
    huntSpawnsFile,
    JSON.stringify({
      note: "test",
      areas: {
        "503": [
          {
            id: 50310,
            artikul_id: 2,
            hunt_mask: "bot_1",
            position_x: 883,
            position_y: 1499,
          },
        ],
      },
    }),
  );
  fs.writeFileSync(
    eventArtikulsFile,
    JSON.stringify({ generated_from: "test", note: "test", artikuls: {}, seen_on_areas: {} }),
  );
  return {
    input: { radveiAreasFile, bgAreasFile, overlayFile, huntSpawnsFile, eventArtikulsFile },
  };
}

function comeInItem(
  id: number,
  title: string,
  toId: string,
  areaId: number,
  flags: number,
): Record<string, unknown> {
  return {
    id,
    title,
    picture: "",
    description: "",
    direction: 0,
    flags,
    confirm_question: "",
    to_id: toId,
    href: {
      object: "common",
      action: "action",
      form: { code: "COME_IN", area_id: areaId },
    },
  };
}

function sampleArea(
  id: string,
  title: string,
  swf: string,
  parentId: string,
  code = "",
): Record<string, unknown> {
  return {
    id,
    title,
    parent_id: parentId,
    region_map: "radvei_map.swf",
    swf,
    settlement: true,
    fight_bg: "2_1",
    code,
    ftime_max: 0,
    items:
      id === "503"
        ? [
            comeInItem(5, "Деревенская лавка", "504", 504, 8),
            comeInItem(9, "Нет такой локации", "99999", 99999, 0),
          ]
        : [],
  };
}
