import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decodeEconomy } from "../../../scripts/content-decode/decode-economy.ts";

describe("economy decoder", () => {
  it("fails the whole corpus on an unknown store field", () => {
    const dir = makeSources();
    const store = JSON.parse(fs.readFileSync(path.join(dir.storesDir, "504.json"), "utf8")) as {
      mystery?: number;
    };
    store.mystery = 1;
    fs.writeFileSync(path.join(dir.storesDir, "504.json"), JSON.stringify(store));
    expect(() => decodeEconomy(dir.input)).toThrow(/unknown field mystery/);
  });

  it("fails on a duplicate lot id after zero-lot remap", () => {
    const dir = makeSources();
    fs.writeFileSync(
      path.join(dir.storesDir, "504.json"),
      JSON.stringify({
        area_id: "504",
        title: "Лавка",
        types: [{ id: -131, title: "Оружие и доспехи", ord: 0 }],
        artikuls: [
          { id: 23, lot_id: 0, type_id: -131, price: 1 },
          { id: 23, lot_id: 23, type_id: -131, price: 1 },
        ],
      }),
    );
    expect(() => decodeEconomy(dir.input)).toThrow(/Duplicate store_lot 504:23/);
  });

  it("omits SUM track 36 and DATA-06 use scripts", () => {
    const first = decodeEconomy(makeSources().input);
    const second = decodeEconomy(makeSources().input);
    expect(first.reputationTracks.map((track) => track.objectId)).toEqual([5, 7]);
    expect(first.reputationTracks.find((track) => track.objectId === 7)?.unlockFlag).toBe("rep_7");
    expect(first.useScripts.map((script) => script.bonusId)).toEqual([2827]);
    expect(first.bonuses.map((bonus) => bonus.id)).toEqual([601]);
    expect(first.storeLots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ areaId: "504", lotId: 80, artikulId: 23, typeId: -131 }),
        expect.objectContaining({
          areaId: "552",
          lotId: 438,
          artikulId: 621,
          requires: { all: [{ type: "RANK", min: 4 }] },
        }),
      ]),
    );
    expect(first.storeTypesManifest.corpusDigest).toBe(second.storeTypesManifest.corpusDigest);
  });

  it("fails leftover diamond pay", () => {
    const dir = makeSources();
    fs.writeFileSync(
      path.join(dir.storesDir, "504.json"),
      JSON.stringify({
        area_id: "504",
        title: "Лавка",
        types: [{ id: -131, title: "Оружие и доспехи", ord: 0 }],
        artikuls: [
          {
            id: 23,
            lot_id: 80,
            type_id: -131,
            price: 1,
            badge_data: [{ id: "1", data: [{ type: "money", cnt: 1, price_type: 3 }] }],
          },
        ],
      }),
    );
    expect(() => decodeEconomy(dir.input)).toThrow(/leftover diamond/);
  });
});

function makeSources(): {
  storesDir: string;
  input: {
    storesDir: string;
    reputationTracksFile: string;
    bonusesFile: string;
    artifactUseFile: string;
  };
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "economy-"));
  const storesDir = path.join(root, "stores");
  fs.mkdirSync(storesDir);
  fs.writeFileSync(
    path.join(storesDir, "504.json"),
    JSON.stringify({
      area_id: "504",
      title: "Деревенская лавка",
      types: [{ id: -131, title: "Оружие и доспехи", ord: 11000 }],
      artikuls: [
        { id: 24, lot_id: 82, type_id: -131, price: 1 },
        { id: 23, lot_id: 80, type_id: -131, price: 1 },
      ],
    }),
  );
  fs.writeFileSync(
    path.join(storesDir, "552.json"),
    JSON.stringify({
      area_id: "552",
      title: "Арсенал",
      types: [{ id: 11, title: "Ювелирные изделия", ord: 0 }],
      artikuls: [
        {
          id: 621,
          lot_id: 438,
          type_id: 11,
          price: 300,
          requires: { all: [{ type: "RANK", min: 4 }] },
        },
      ],
    }),
  );
  const reputationTracksFile = path.join(root, "reputation-tracks.json");
  const bonusesFile = path.join(root, "bonuses.json");
  const artifactUseFile = path.join(root, "artifact-use.json");
  fs.writeFileSync(
    reputationTracksFile,
    JSON.stringify({
      note: "test",
      tracks: [
        {
          object_id: 5,
          type: 2,
          title: "Репутация Радвея",
          image: "rep_radvey_sm.png",
        },
        {
          object_id: 7,
          type: 2,
          title: "Репутация Ведьмака",
          image: "rep_vedmak_sm.png",
          unlock_flag: "rep_7",
        },
        {
          object_id: 36,
          type: 3,
          title: "Суммарная репутация",
          image: "",
        },
      ],
    }),
  );
  fs.writeFileSync(
    bonusesFile,
    JSON.stringify({
      _note: "test",
      bonuses: [
        {
          id: 601,
          kind: "skill",
          skillId: "AGRILKA_MOBOV",
          delta: 1,
          needValue: 0,
          artikulId: 623,
          title: "Пособие «Слабая злость»",
          chatMsg: "msg",
        },
      ],
    }),
  );
  fs.writeFileSync(
    artifactUseFile,
    JSON.stringify({
      _note: "test",
      scripts: [
        {
          bonusId: 2827,
          require: [{ artikulId: 2371, count: 2 }],
          failPlaque: "",
          effects: [
            { type: "consume", artikulId: 2371, count: 2 },
            { type: "grant", artikulId: 55, count: 1 },
          ],
        },
        {
          bonusId: 900584,
          require: [{ artikulId: 584, count: 1 }],
          failPlaque: "Головы нет в сумке",
          effects: [{ type: "openDialog", dialogKey: "d_271", npcId: 271 }],
        },
      ],
    }),
  );
  return {
    storesDir,
    input: { storesDir, reputationTracksFile, bonusesFile, artifactUseFile },
  };
}
