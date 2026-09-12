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

  it("rejects bot loot that points at a missing artifact", () => {
    const bot = playable.bots[0];
    if (!bot) throw new Error("playable bundle has no bots");
    const bundle: ContentBundle = {
      ...playable,
      bots: replaceBot(bot, {
        ...bot,
        lootEntries: [
          ...bot.lootEntries,
          { artikulId: 8, dropWeight: 1, countMin: 1, countMax: 1 },
        ],
      }),
    };
    expect(() => new ContentValidator().validate(bundle)).toThrow(
      /loot artikul 8 is not in the bundle/,
    );
  });

  it("rejects duplicate loot artikul on the same bot", () => {
    const bot = playable.bots[0];
    const entry = bot?.lootEntries[0];
    if (!bot || !entry) throw new Error("playable bundle has no bot loot");
    const bundle: ContentBundle = {
      ...playable,
      bots: replaceBot(bot, { ...bot, lootEntries: [...bot.lootEntries, entry] }),
    };
    expect(() => new ContentValidator().validate(bundle)).toThrow(/duplicate loot artikul/);
  });

  it("rejects Gryzl with a non-empty spell book", () => {
    const gryzl = playable.bots.find((row) => row.id === 2);
    const hissa = playable.bots.find((row) => row.id === 4);
    const card = hissa?.spellBook.spells[0];
    if (!gryzl || !card) throw new Error("playable bundle is missing bots 2/4");
    const bundle: ContentBundle = {
      ...playable,
      bots: replaceBot(gryzl, {
        ...gryzl,
        spellBook: { nothingWeight: 100, spells: [card] },
      }),
    };
    expect(() => new ContentValidator().validate(bundle)).toThrow(/bot 2 spellBook must be empty/);
  });

  it("rejects an area_link whose destination is not in the bundle", () => {
    const link = playable.areaLinks[0];
    if (!link) throw new Error("playable bundle has no area links");
    const bundle: ContentBundle = {
      ...playable,
      areaLinks: [
        {
          ...link,
          toAreaId: "502",
          toId: "502",
          href: { object: "common", action: "action", form: { code: "COME_IN", area_id: 502 } },
        },
      ],
    };
    expect(() => new ContentValidator().validate(bundle)).toThrow(/to-area 502 is missing/);
  });

  it("rejects an area whose parent is not in the bundle", () => {
    const area = playable.areas.find((entry) => entry.id === "503");
    if (!area) throw new Error("playable bundle is missing area 503");
    const bundle: ContentBundle = {
      ...playable,
      areas: playable.areas.map((entry) =>
        entry.id === "503" ? { ...entry, parentId: "498" } : entry,
      ),
    };
    expect(() => new ContentValidator().validate(bundle)).toThrow(
      /parent 498 is not in the bundle/,
    );
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

  it("rejects artifact 93 without dump-proven extra.spell", () => {
    const bundle: ContentBundle = {
      ...playable,
      artifacts: playable.artifacts.map((artifact) =>
        artifact.id === 93 ? { ...artifact, extra: {} } : artifact,
      ),
    };
    expect(() => new ContentValidator().validate(bundle)).toThrow(
      /artifact 93 is missing dump-proven extra.spell/,
    );
  });

  it("rejects artifact 77 carrying a fight spell blob", () => {
    const meat = playable.artifacts.find((artifact) => artifact.id === 77);
    if (!meat) throw new Error("playable bundle is missing artifact 77");
    const bundle: ContentBundle = {
      ...playable,
      artifacts: playable.artifacts.map((artifact) =>
        artifact.id === 77
          ? {
              ...meat,
              extra: { spell: { effects: [{ kind: 2, amount: 1 }] } },
            }
          : artifact,
      ),
    };
    expect(() => new ContentValidator().validate(bundle)).toThrow(
      /artifact 77 must not carry a fight spell blob/,
    );
  });

  it("rejects a store type that has no lots", () => {
    const bundle: ContentBundle = {
      ...playable,
      storeTypes: [...playable.storeTypes, { areaId: "504", typeId: 10, title: "Еда", ord: 0 }],
    };
    expect(() => new ContentValidator().validate(bundle)).toThrow(/store_type 504:10 has no lots/);
  });

  it("rejects a store lot whose artifact is not in the bundle", () => {
    const bundle: ContentBundle = {
      ...playable,
      storeLots: [
        ...playable.storeLots,
        {
          areaId: "504",
          lotId: 99,
          artikulId: 8,
          typeId: -131,
          price: 1,
          ord: 99,
          pay: { currency: "gold", amount: 1 },
        },
      ],
    };
    expect(() => new ContentValidator().validate(bundle)).toThrow(
      /store_lot 504:99 artifact 8 is not in the bundle/,
    );
  });

  it("rejects a gold lot whose pay amount does not match price", () => {
    const lot = playable.storeLots.find((row) => row.lotId === 80);
    if (!lot) throw new Error("playable bundle is missing lot 80");
    const bundle: ContentBundle = {
      ...playable,
      storeLots: playable.storeLots.map((row) =>
        row.lotId === 80 ? { ...row, pay: { currency: "gold", amount: 2 } } : row,
      ),
    };
    expect(() => new ContentValidator().validate(bundle)).toThrow(
      /store_lot 504:80 gold pay must match price/,
    );
  });

  it("rejects SUM 36 and extra faction tracks", () => {
    expect(() =>
      new ContentValidator().validate({
        ...playable,
        reputationTracks: [
          ...playable.reputationTracks,
          {
            objectId: 36,
            type: 2,
            title: "Суммарная репутация",
            image: "x.png",
            unlockFlag: "",
          },
        ],
      }),
    ).toThrow(/reputation track 36 is not in the playable slice/);
    expect(() =>
      new ContentValidator().validate({
        ...playable,
        reputationTracks: [
          ...playable.reputationTracks,
          {
            objectId: 7,
            type: 2,
            title: "Репутация Ведьмака",
            image: "rep_vedmak_sm.png",
            unlockFlag: "",
          },
        ],
      }),
    ).toThrow(/reputation track 7 is not in the playable slice/);
  });

  it("rejects a bundle without Radvey track 5", () => {
    expect(() =>
      new ContentValidator().validate({
        ...playable,
        reputationTracks: [],
      }),
    ).toThrow(/reputation track 5 is required/);
  });

  it("rejects a bundle without professions 2 and 6", () => {
    expect(() =>
      new ContentValidator().validate({
        ...playable,
        professions: [],
      }),
    ).toThrow(/profession 2 is required/);
  });

  it("rejects a bundle without assistant 3", () => {
    expect(() =>
      new ContentValidator().validate({
        ...playable,
        assistantTypes: playable.assistantTypes.filter((row) => row.id !== 3),
      }),
    ).toThrow(/assistant type 3 is required/);
  });

  it("rejects a bundle without craft recipe 61", () => {
    expect(() =>
      new ContentValidator().validate({
        ...playable,
        craftRecipes: [],
      }),
    ).toThrow(/craft recipe 61 is required/);
  });

  it("rejects a bundle without exactly one playable battleground", () => {
    expect(() =>
      new ContentValidator().validate({
        ...playable,
        battlegrounds: [],
      }),
    ).toThrow(/expected one playable battleground/);
  });

  it("rejects paperdoll extra.spell with triggers, onlyPvP, or non-kind-3", () => {
    const tyrant = playable.artifacts.find((artifact) => artifact.id === 20546);
    const spell = tyrant?.extra.spell;
    if (!tyrant || !spell) throw new Error("playable bundle is missing artifact 20546");
    expect(() =>
      new ContentValidator().validate(
        replaceArtifact(tyrant, {
          ...tyrant,
          extra: {
            ...tyrant.extra,
            spell: { ...spell, effects: spell.effects, triggers: { hit: true } },
          },
        }),
      ),
    ).toThrow(/must not have triggers/);
    expect(() =>
      new ContentValidator().validate(
        replaceArtifact(tyrant, {
          ...tyrant,
          extra: {
            ...tyrant.extra,
            spell: { ...spell, effects: spell.effects, onlyPvP: true },
          },
        }),
      ),
    ).toThrow(/must not have onlyPvP/);
    const effect = spell.effects[0];
    if (!effect) throw new Error("20546 extra.spell effects are missing");
    expect(() =>
      new ContentValidator().validate(
        replaceArtifact(tyrant, {
          ...tyrant,
          extra: {
            ...tyrant.extra,
            spell: { ...spell, effects: [{ ...effect, kind: 9 }] },
          },
        }),
      ),
    ).toThrow(/kind must be 3/);
  });

  it("rejects paperdoll extra.spell without authored duration or picture", () => {
    const tyrant = playable.artifacts.find((artifact) => artifact.id === 20546);
    const spell = tyrant?.extra.spell;
    const effect = spell?.effects[0];
    if (!tyrant || !spell || !effect) throw new Error("playable bundle is missing artifact 20546");
    const rest = { ...effect };
    delete (rest as { duration?: number }).duration;
    expect(() =>
      new ContentValidator().validate(
        replaceArtifact(tyrant, {
          ...tyrant,
          extra: {
            ...tyrant.extra,
            spell: { ...spell, effects: [rest] },
          },
        }),
      ),
    ).toThrow(/duration is required/);
    expect(() =>
      new ContentValidator().validate(replaceArtifact(tyrant, { ...tyrant, picture: "" })),
    ).toThrow(/picture is required for gear-spell img/);
  });
});

describe("parseContentBundle", () => {
  it("rejects an unknown schema version", () => {
    expect(() => parseContentBundle({ ...playable, schemaVersion: "v0" })).toThrow();
  });

  it("rejects a dungeon spawn that authors both a route and a zone", () => {
    const dungeon = playable.dungeons[0];
    const area = dungeon?.areas[0];
    const spawn = area?.spawns[0];
    if (!dungeon || !area || !spawn) throw new Error("playable bundle has no dungeon spawn");
    expect(() =>
      parseContentBundle({
        ...playable,
        dungeons: [
          {
            ...dungeon,
            areas: [
              {
                ...area,
                spawns: [
                  {
                    ...spawn,
                    zone: [
                      { x: 1, y: 1 },
                      { x: 2, y: 2 },
                      { x: 3, y: 3 },
                    ],
                    route: [
                      { x: 1, y: 1, waitMin: 1, waitMax: 1 },
                      { x: 2, y: 2, waitMin: 1, waitMax: 1 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow(/cannot author both a route and a zone/);
  });

  it("rejects a hunt spawn zone with fewer than 3 points", () => {
    const spawn = playable.huntSpawns[0];
    if (!spawn) throw new Error("playable bundle has no hunt spawns");
    expect(() =>
      parseContentBundle({
        ...playable,
        huntSpawns: [
          {
            ...spawn,
            zone: [
              { x: 1, y: 1 },
              { x: 2, y: 2 },
            ],
            route: [],
          },
        ],
      }),
    ).toThrow(/zone must be empty or have at least 3 points/);
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

  it("rejects an artifact missing artifact_actions", () => {
    const artifact = playable.artifacts[0];
    if (!artifact) throw new Error("playable bundle has no artifacts");
    const withoutActions = { ...artifact } as { artifact_actions?: unknown };
    delete withoutActions.artifact_actions;
    expect(() =>
      parseContentBundle({
        ...playable,
        artifacts: [withoutActions],
      }),
    ).toThrow();
  });

  it("rejects a bundle without npc 271", () => {
    expect(() => new ContentValidator().validate({ ...playable, npcs: [] })).toThrow(
      /npc 271 is required/,
    );
  });

  it("rejects a bundle without quest q_engine_board", () => {
    expect(() =>
      new ContentValidator().validate({
        ...playable,
        quests: playable.quests.filter((quest) => quest.key !== "q_engine_board"),
      }),
    ).toThrow(/quest q_engine_board is required/);
  });

  it("rejects a bundle without quest q_engine_daily", () => {
    expect(() =>
      new ContentValidator().validate({
        ...playable,
        quests: playable.quests.filter((quest) => quest.key !== "q_engine_daily"),
      }),
    ).toThrow(/quest q_engine_daily is required/);
  });

  it("rejects a bundle without quest q_engine_roster", () => {
    expect(() =>
      new ContentValidator().validate({
        ...playable,
        quests: playable.quests.filter((quest) => quest.key !== "q_engine_roster"),
      }),
    ).toThrow(/quest q_engine_roster is required/);
  });

  it("rejects a bundle without exactly one daily quest", () => {
    const extra = playable.quests.find((quest) => quest.key === "q_engine_daily");
    if (!extra) throw new Error("q_engine_daily is required in playable");
    expect(() =>
      new ContentValidator().validate({
        ...playable,
        quests: [
          ...playable.quests,
          { ...extra, key: "q_engine_daily_extra", bookId: 6, pointId: 6, boardOrd: 6 },
        ],
      }),
    ).toThrow(/exactly one quest with flags & 1/);
  });

  it("rejects an NPC href in an area_link", () => {
    const link = playable.areaLinks[0];
    if (!link) throw new Error("playable bundle has no area links");
    expect(() =>
      parseContentBundle({
        ...playable,
        areaLinks: [
          {
            ...link,
            href: { object: "npc", action: "quests", ref: 1617 },
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects an artifact missing extra", () => {
    const artifact = playable.artifacts[0];
    if (!artifact) throw new Error("playable bundle has no artifacts");
    const withoutExtra = { ...artifact } as { extra?: unknown };
    delete withoutExtra.extra;
    expect(() =>
      parseContentBundle({
        ...playable,
        artifacts: [withoutExtra],
      }),
    ).toThrow();
  });

  it("rejects a hunt look without fight sk", () => {
    const bot = playable.bots[0];
    if (!bot) throw new Error("playable bundle has no bots");
    expect(() =>
      parseContentBundle({
        ...playable,
        bots: [{ ...bot, hunt: { ...bot.hunt, sk: "" } }],
      }),
    ).toThrow();
  });

  it("rejects duplicate loot artikul ids on a bot", () => {
    const bot = playable.bots[0];
    const entry = bot?.lootEntries[0];
    if (!bot || !entry) throw new Error("playable bundle has no bot loot");
    expect(() =>
      parseContentBundle({
        ...playable,
        bots: [{ ...bot, lootEntries: [...bot.lootEntries, entry] }],
      }),
    ).toThrow(/lootEntries artikul ids must be unique/);
  });
});

function replaceArtifact(
  artifact: ContentBundle["artifacts"][number],
  next: ContentBundle["artifacts"][number],
): ContentBundle {
  return {
    ...playable,
    artifacts: playable.artifacts.map((row) => (row.id === artifact.id ? next : row)),
  };
}

function replaceBot(
  bot: ContentBundle["bots"][number],
  next: ContentBundle["bots"][number],
): ContentBundle["bots"] {
  return playable.bots.map((row) => (row.id === bot.id ? next : row));
}
