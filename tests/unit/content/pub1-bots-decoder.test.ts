import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { encodeAmf3, type AmfValue } from "../../../src/modules/jugger-wire/amf/amf3.ts";
import { decodePub1Bots } from "../../../scripts/content-decode/decode-pub1-bots.ts";

describe("Pub1 bot decoder", () => {
  it("fails the whole corpus on an unreadable bestiary", () => {
    const dir = makeSources({ bestiaryBytes: Buffer.from([0xff]) });
    expect(() => decodePub1Bots(dir.input)).toThrow(/Unreadable AMF record/);
  });

  it("fails when overlay loot references a missing artifact", () => {
    const dir = makeSources({});
    const overlay = JSON.parse(fs.readFileSync(dir.input.overlayFile, "utf8")) as {
      bots: Record<string, { loot: { entries: Array<{ artikul_id: number }> } }>;
    };
    overlay.bots["2"]!.loot.entries[0]!.artikul_id = 999;
    fs.writeFileSync(dir.input.overlayFile, JSON.stringify(overlay));
    expect(() => decodePub1Bots(dir.input)).toThrow(/loot artikul 999 is not in the item corpus/);
  });

  it("applies overlay loot and is stable for the same bytes", () => {
    const dir = makeSources({});
    const first = decodePub1Bots(dir.input);
    const second = decodePub1Bots(dir.input);
    expect(first.bots).toHaveLength(1);
    expect(first.bots[0]?.id).toBe(2);
    expect(first.loot[0]?.lootEntries).toEqual([
      { artikulId: 77, dropWeight: 77, countMin: 1, countMax: 2 },
    ]);
    expect(first.spellBooks[0]?.spells.map((card) => card.artikulId)).toEqual([396]);
    expect(first.botsManifest.corpusDigest).toBe(second.botsManifest.corpusDigest);
  });
});

function makeSources(input: { bestiaryBytes?: Buffer }): {
  input: {
    pub1Dir: string;
    overlayFile: string;
    gapFillFile: string;
    huntLooksFile: string;
    spellBookFile: string;
    itemsFile: string;
  };
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pub1-bots-"));
  const amfDir = path.join(root, "images/locale/ru/amf");
  fs.mkdirSync(amfDir, { recursive: true });
  fs.writeFileSync(
    path.join(amfDir, "bestiary.amf"),
    input.bestiaryBytes ?? encodeAmf3({ bots: { "2": sampleBot(2) } }),
  );
  const overlayFile = path.join(root, "overlay.json");
  const gapFillFile = path.join(root, "gap.json");
  const huntLooksFile = path.join(root, "hunt.json");
  const spellBookFile = path.join(root, "spells.json");
  const itemsFile = path.join(root, "items.json");
  fs.writeFileSync(overlayFile, JSON.stringify({ bots: { "2": overlayBot() } }));
  fs.writeFileSync(gapFillFile, JSON.stringify({ bots: {} }));
  fs.writeFileSync(huntLooksFile, JSON.stringify({ areas: {} }));
  fs.writeFileSync(
    spellBookFile,
    JSON.stringify({
      bots: [
        {
          botId: 2,
          nothingWeight: 100,
          spells: [
            {
              artikulId: 396,
              slot: "turn_roulette",
              weight: 10,
              maxCasts: null,
              gate: null,
              hpPct: null,
            },
          ],
        },
      ],
    }),
  );
  fs.writeFileSync(itemsFile, JSON.stringify([sampleArtifact(77), sampleArtifact(396)]));
  return {
    input: {
      pub1Dir: root,
      overlayFile,
      gapFillFile,
      huntLooksFile,
      spellBookFile,
      itemsFile,
    },
  };
}

function sampleBot(id: number): AmfValue {
  return {
    id,
    nick: "Грызл",
    level: "1",
    ultrabeast: 0,
    avatar: "avatar_gryzl1_sm.jpg",
    avatar_big: "avatar_gryzl1.jpg",
    group: "1",
    description: "",
    legend: "",
    base_exp: "15",
    money_min: "0.20",
    money_max: "0.44",
    kind: "0",
    trend: "0",
    sk: "11",
    body: "",
    arena: "2_1",
    skills: { STR: 8, VIT: 10, LUCK: 20 },
    effects: [],
    drop: { "77": "77" },
  };
}

function overlayBot(): Record<string, unknown> {
  return {
    id: 2,
    nick: "Грызл",
    level: 1,
    sk: "11",
    avatar: "avatar_gryzl1_sm.jpg",
    body: "",
    kind: 0,
    ultrabeast: 0,
    base_exp: 15,
    money_min: 0.2,
    money_max: 0.44,
    str: 8,
    vit: 10,
    extra_json: { hunt: { hunt_swf: "gryzl1.swf", hunt_scale: 90, hunt_fps: 15, speed: 10 } },
    loot: {
      drop_cnt: 1,
      bonus_chance: 0.2,
      bonus_min: 1,
      bonus_max: 1,
      nothing_weight: 3000,
      entries: [{ artikul_id: 77, drop_weight: 77, count_min: 1, count_max: 2 }],
    },
  };
}

function sampleArtifact(id: number): Record<string, unknown> {
  return {
    id,
    title: `item ${id}`,
    picture: "x.png",
    typeId: "10",
    kindId: 1,
    slotMask: 0,
    weight: 0,
    levelMin: 1,
    levelMax: 0,
    gender: 0,
    priceMinor: 100,
    flags: 0,
    bagStack: 10,
    durability: 0,
    durabilityMax: 0,
    skills: [],
    artifact_actions: {},
    extra:
      id === 396
        ? {
            spell: {
              animData: "magic_direct",
              endTurn: true,
              effects: [{ kind: 1, skills: [{ skill_id: "pcSTR", value: -50 }] }],
            },
          }
        : {},
  };
}
