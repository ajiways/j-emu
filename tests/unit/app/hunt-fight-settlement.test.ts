import { describe, expect, it } from "vitest";
import { HuntFightSettlement } from "../../../src/app/hunt-fight-settlement.ts";
import type { Catalog } from "../../../src/modules/catalog/ports/catalog.ts";
import type { ArtifactDefinition } from "../../../src/modules/catalog/domain/artifact-definition.ts";
import type { FightOutcomeSnapshot } from "../../../src/modules/combat/domain/fight-outcome-snapshot.ts";
import { goldToMinor, goldWireString } from "../../../src/modules/combat/domain/fight-money.ts";
import { splitFightExperience } from "../../../src/modules/combat/domain/split-fight-experience.ts";
import type { InventoryService } from "../../../src/modules/inventory/domain/inventory-service.ts";
import type { UnitOfWork } from "../../../src/shared/kernel/unit-of-work.ts";
import { testArtifact } from "../../support/artifact-fixtures.ts";
import { playableHuntBot } from "../../support/playable-bot.ts";
import { SequenceRandom } from "../../support/fakes/sequence-random.ts";
import { HEROISM_RULES } from "../../../src/app/heroism-rules.ts";
import { PvpFightHonorCache } from "../../../src/app/pvp-fight-honor-cache.ts";
import { DungeonPersonalGrant } from "../../../src/app/dungeon-personal-grant.ts";
import { testHero } from "../../support/hero-fixtures.ts";

function silentDungeonGrant(): DungeonPersonalGrant {
  return new DungeonPersonalGrant(
    { peekFight: () => null },
    { dungeonByArea: async () => null, killedSpawnKeys: async () => [] },
  );
}

describe("HuntFightSettlement", () => {
  const bot = playableHuntBot();
  const minMoneyMinor = goldToMinor(bot.reward.moneyMin);
  const minMoneyWire = goldWireString(minMoneyMinor);

  it("grants EXP/money/loot on win once and skips them on loss", async () => {
    const characters = recordingCharacters();
    const inventory = recordingInventory();
    const bestiary = recordingBestiary();
    const settlement = new HuntFightSettlement(
      identityUow(),
      fakeCatalog(),
      characters,
      inventory,
      new SequenceRandom([0, 0, 0, 0]),
      { routeFor: async () => null },
      { deposit: async () => undefined },
      { notify: async () => undefined },
      bestiary,
      unlimitedLoot(),
      HEROISM_RULES,
      new PvpFightHonorCache(),
      silentDungeonGrant(),
    );
    const win = await settlement.persistFinished(outcome("win", 27, 20));
    expect(characters.notes).toEqual([{ characterId: 1, hp: 27 }]);
    expect(characters.defeats).toEqual([]);
    expect(characters.grants).toEqual([
      { characterId: 1, operationId: "fight:9:1", amount: bot.reward.baseExp },
    ]);
    expect(characters.credits).toEqual([{ characterId: 1, minorUnits: minMoneyMinor }]);
    expect(inventory.refills).toHaveLength(1);
    expect(inventory.deaths).toEqual([]);
    expect(inventory.grants).toEqual([]);
    expect(bestiary.wins).toEqual([{ heroId: 1, botId: bot.id }]);
    expect(win.get(10)).toMatchObject({
      status: 100,
      fight_id: 9,
      experience: bot.reward.baseExp,
      money: minMoneyWire,
      honor: 0,
      revenge: 0,
      loot: [],
      artikul_list: [],
    });
    characters.notes.length = 0;
    characters.grants.length = 0;
    characters.credits.length = 0;
    bestiary.wins.length = 0;
    const again = await settlement.persistFinished(outcome("win", 27, 20));
    expect(again.get(10)).toEqual(win.get(10));
    expect(characters.notes).toEqual([]);
    expect(characters.grants).toEqual([]);
    expect(bestiary.wins).toEqual([]);

    const lossCharacters = recordingCharacters();
    const lossInventory = recordingInventory();
    const lossBestiary = recordingBestiary();
    const loss = new HuntFightSettlement(
      identityUow(),
      fakeCatalog(),
      lossCharacters,
      lossInventory,
      new SequenceRandom([0, 0, 0, 0]),
      { routeFor: async () => null },
      { deposit: async () => undefined },
      { notify: async () => undefined },
      lossBestiary,
      unlimitedLoot(),
      HEROISM_RULES,
      new PvpFightHonorCache(),
      silentDungeonGrant(),
    );
    const lost = await loss.persistFinished(outcome("loss", 0, 20));
    expect(lossCharacters.notes).toEqual([]);
    expect(lossCharacters.defeats).toEqual([{ characterId: 1, hp: 0 }]);
    expect(lossCharacters.grants).toEqual([]);
    expect(lossCharacters.credits).toEqual([]);
    expect(lossInventory.deaths).toHaveLength(1);
    expect(lossBestiary.wins).toEqual([]);
    expect(lost.get(10)).toMatchObject({ experience: 0, money: "0", loot: [] });
  });

  it("grants Gryzl 77 when the loot unit draw lands past NOTHING", async () => {
    const inventory = recordingInventory();
    const settlement = new HuntFightSettlement(
      identityUow(),
      fakeCatalog(),
      recordingCharacters(),
      inventory,
      new SequenceRandom([0, 0.2, 0.95, 1]),
      { routeFor: async () => null },
      { deposit: async () => undefined },
      { notify: async () => undefined },
      recordingBestiary(),
      unlimitedLoot(),
      HEROISM_RULES,
      new PvpFightHonorCache(),
      silentDungeonGrant(),
    );
    const win = await settlement.persistFinished(outcome("win", 27, 20));
    expect(inventory.grants).toEqual([{ characterId: 1, artifactId: 77, quantity: 1 }]);
    expect(win.get(10)).toMatchObject({
      loot: { "77": { artikul_id: 77, amount: 1 } },
    });
  });

  it("clips hunt drops to the current quest loot remainder", async () => {
    const inventory = recordingInventory();
    inventory.bag.set(77, 1);
    const settlement = new HuntFightSettlement(
      identityUow(),
      fakeCatalog(),
      recordingCharacters(),
      inventory,
      new SequenceRandom([0, 0.2, 0.95, 1]),
      { routeFor: async () => null },
      { deposit: async () => undefined },
      { notify: async () => undefined },
      recordingBestiary(),
      {
        needed: async (_heroId, artikulId, owned) =>
          artikulId === 77 ? Math.max(0, 1 - owned) : null,
      },
      HEROISM_RULES,
      new PvpFightHonorCache(),
      silentDungeonGrant(),
    );
    await settlement.persistFinished(outcome("win", 27, 20));
    expect(inventory.grants).toEqual([]);
  });

  it("splits EXP by damage and gives loot only to the top damager", async () => {
    const characters = recordingCharacters();
    const settlement = new HuntFightSettlement(
      identityUow(),
      fakeCatalog(),
      characters,
      recordingInventory(),
      new SequenceRandom([0, 0, 0, 0]),
      { routeFor: async () => null },
      { deposit: async () => undefined },
      { notify: async () => undefined },
      recordingBestiary(),
      unlimitedLoot(),
      HEROISM_RULES,
      new PvpFightHonorCache(),
      silentDungeonGrant(),
    );
    const result = await settlement.persistFinished({
      mode: "hunt",
      fightId: "9",
      botId: bot.id,
      botLevel: bot.level,
      winnerTeam: 1,
      kind: "win",
      humans: [human(10, 1, 10), { ...human(11, 2, 5), damageToBot: 5 }],
    });
    const experience = splitFightExperience(bot.reward.baseExp, bot.level, [
      { characterId: 1, damage: 10, level: 1 },
      { characterId: 2, damage: 5, level: 1 },
    ]);
    expect(characters.grants).toEqual([
      { characterId: 1, operationId: "fight:9:1", amount: experience.get(1) },
      { characterId: 2, operationId: "fight:9:2", amount: experience.get(2) },
    ]);
    expect(characters.credits).toEqual([{ characterId: 1, minorUnits: minMoneyMinor }]);
    expect(result.get(10)).toMatchObject({ experience: experience.get(1), money: minMoneyWire });
    expect(result.get(11)).toMatchObject({ experience: experience.get(2), money: "0" });
  });

  it("persists team-2 HP without hunt EXP or loot on opener-team win", async () => {
    const characters = recordingCharacters();
    const inventory = recordingInventory();
    const settlement = new HuntFightSettlement(
      identityUow(),
      fakeCatalog(),
      characters,
      inventory,
      new SequenceRandom([0, 0, 0, 0]),
      { routeFor: async () => null },
      { deposit: async () => undefined },
      { notify: async () => undefined },
      recordingBestiary(),
      unlimitedLoot(),
      HEROISM_RULES,
      new PvpFightHonorCache(),
      silentDungeonGrant(),
    );
    const result = await settlement.persistFinished({
      mode: "hunt",
      fightId: "9",
      botId: bot.id,
      botLevel: bot.level,
      winnerTeam: 1,
      kind: "win",
      humans: [human(10, 1, 20), { ...human(11, 2, 0), team: 2, hp: 19 }],
    });
    expect(characters.notes).toEqual([
      { characterId: 1, hp: 27 },
      { characterId: 2, hp: 19 },
    ]);
    expect(characters.grants).toEqual([
      { characterId: 1, operationId: "fight:9:1", amount: bot.reward.baseExp },
    ]);
    expect(characters.credits).toEqual([{ characterId: 1, minorUnits: minMoneyMinor }]);
    expect(inventory.grants).toEqual([]);
    expect(result.get(10)).toMatchObject({ experience: bot.reward.baseExp });
    expect(result.get(11)).toMatchObject({ experience: 0, money: "0", loot: [] });
  });

  it("restores practice HP/MP/pocket and skips loot", async () => {
    const characters = recordingCharacters();
    const inventory = recordingInventory();
    const settlement = new HuntFightSettlement(
      identityUow(),
      fakeCatalog(),
      characters,
      inventory,
      new SequenceRandom([0, 0, 0, 0]),
      { routeFor: async () => null },
      { deposit: async () => undefined },
      { notify: async () => undefined },
      recordingBestiary(),
      unlimitedLoot(),
      HEROISM_RULES,
      new PvpFightHonorCache(),
      silentDungeonGrant(),
    );
    const loot = await settlement.persistFinished({
      mode: "friendly-practice",
      fightId: "8",
      winnerTeam: 1,
      kind: "win",
      humans: [
        { ...human(10, 1, 0, 0), leftLive: false },
        { ...human(11, 2, 0, 3), leftLive: false },
      ],
      restore: [
        { characterId: 1, hp: 27, mp: 10, pocket: [] },
        { characterId: 2, hp: 27, mp: 10, pocket: [] },
      ],
    });
    expect(characters.notes).toEqual([
      { characterId: 1, hp: 27 },
      { characterId: 2, hp: 27 },
    ]);
    expect(characters.mps).toEqual([
      { characterId: 1, mp: 10 },
      { characterId: 2, mp: 10 },
    ]);
    expect(characters.grants).toEqual([]);
    expect(characters.credits).toEqual([]);
    expect(characters.defeats).toEqual([]);
    expect(inventory.grants).toEqual([]);
    expect(loot.size).toBe(0);
  });

  it("grants PvP honor once from applied human damage", async () => {
    const characters = recordingCharacters();
    const cache = new PvpFightHonorCache();
    const settlement = new HuntFightSettlement(
      identityUow(),
      fakeCatalog(),
      characters,
      recordingInventory(),
      new SequenceRandom([0, 0, 0, 0]),
      { routeFor: async () => null },
      { deposit: async () => undefined },
      { notify: async () => undefined },
      recordingBestiary(),
      unlimitedLoot(),
      HEROISM_RULES,
      cache,
      silentDungeonGrant(),
    );
    const snapshot: FightOutcomeSnapshot = {
      mode: "pvp",
      fightId: "44",
      winnerTeam: 1,
      kind: "win",
      humans: [
        {
          ...human(10, 1, 0, 50),
          team: 1,
          level: 7,
          maxHp: 111,
          damageToHumans: 350,
        },
        {
          ...human(11, 2, 0, 0),
          team: 2,
          level: 6,
          maxHp: 108,
          damageToHumans: 222,
        },
      ],
    };
    const first = await settlement.persistFinished(snapshot);
    expect(first.size).toBe(0);
    expect(characters.notes).toEqual([{ characterId: 1, hp: 50 }]);
    expect(characters.defeats).toEqual([{ characterId: 2, hp: 0 }]);
    expect(characters.honorGrants).toEqual([
      { characterId: 1, operationId: "pvp:44:1", amount: 68 },
      { characterId: 2, operationId: "pvp:44:2", amount: 26 },
    ]);
    expect(cache.sharesFor("44")).toEqual([
      { characterId: 1, accountId: 10, honor: 68, dmg: 350, rank: "0" },
      { characterId: 2, accountId: 11, honor: 26, dmg: 222, rank: "0" },
    ]);
    characters.honorGrants.length = 0;
    await settlement.persistFinished(snapshot);
    expect(characters.honorGrants).toEqual([]);
  });
});

function outcome(kind: "win" | "loss", hp: number, damageToBot: number): FightOutcomeSnapshot {
  const bot = playableHuntBot();
  return {
    mode: "hunt",
    fightId: "9",
    botId: bot.id,
    botLevel: bot.level,
    winnerTeam: kind === "win" ? 1 : 2,
    kind,
    humans: [human(10, 1, damageToBot, hp)],
  };
}

function human(
  accountId: number,
  characterId: number,
  damageToBot: number,
  hp = 27,
): FightOutcomeSnapshot["humans"][number] {
  return {
    accountId,
    characterId,
    team: 1,
    level: 1,
    hp,
    maxHp: 27,
    damageToBot,
    damageToHumans: 0,
    leftLive: false,
    pocket: [],
  };
}

function recordingBestiary() {
  return {
    wins: [] as Array<{ heroId: number; botId: number }>,
    async noteWin(heroId: number, botId: number) {
      this.wins.push({ heroId, botId });
    },
    async listWins() {
      return [];
    },
  };
}

function identityUow(): UnitOfWork {
  return { run: (work) => work() };
}

function recordingCharacters() {
  return {
    notes: [] as Array<{ characterId: number; hp: number }>,
    mps: [] as Array<{ characterId: number; mp: number }>,
    defeats: [] as Array<{ characterId: number; hp: 0 }>,
    grants: [] as Array<{ characterId: number; operationId: string; amount: number }>,
    honorGrants: [] as Array<{ characterId: number; operationId: string; amount: number }>,
    credits: [] as Array<{ characterId: number; minorUnits: number }>,
    async noteHp(command: { characterId: number; hp: number }) {
      this.notes.push(command);
      return snapshot(command.characterId, command.hp);
    },
    async noteMp(command: { characterId: number; mp: number }) {
      this.mps.push(command);
      return snapshot(command.characterId, 27);
    },
    async noteDefeat(command: { characterId: number; hp: 0 }) {
      this.defeats.push(command);
      return snapshot(command.characterId, 0);
    },
    async resurrect() {
      throw new Error("unused");
    },
    async grantExperience(command: { characterId: number; operationId: string; amount: number }) {
      this.grants.push(command);
      return {
        expBefore: 1,
        expAfter: 1 + command.amount,
        levelBefore: 1,
        levelAfter: 1,
        levelsGained: 0,
        contentReleaseId: "r",
        progressionDigest: "d",
      };
    },
    async grantHonor(command: { characterId: number; operationId: string; amount: number }) {
      this.honorGrants.push(command);
      return {
        honorBefore: 0,
        honorAfter: command.amount,
        added: command.amount,
        rank: 0,
        honorMin: 0,
        honorMax: 100,
        honorStatus: 0,
        contentReleaseId: "r",
      };
    },
    async creditMoney(command: { characterId: number; minorUnits: number }) {
      this.credits.push(command);
    },
    async debitMoney() {
      throw new Error("unused");
    },
    async debitMoneyGold() {
      throw new Error("unused");
    },
    async lockById(characterId: number) {
      return testHero({ id: characterId });
    },
    async applyEquipmentVitals() {
      throw new Error("unused");
    },
    async syncResources() {
      throw new Error("unused");
    },
  };
}

function snapshot(characterId: number, hp: number) {
  return {
    characterId,
    hp,
    maxHp: 27,
    hpTime: 0,
    regenAt: new Date(0),
    inActiveFight: false,
    persisted: true,
  };
}

function unlimitedLoot() {
  return { needed: async () => null };
}

function recordingInventory() {
  const inventory = {
    refills: [] as unknown[],
    grants: [] as unknown[],
    deaths: [] as unknown[],
    bag: new Map<number, number>(),
    async grantToBag(command: { characterId: number; artifactId: number; quantity: number }) {
      inventory.grants.push(command);
    },
    async countBagByArtifact(command: { artifactId: number }) {
      return inventory.bag.get(command.artifactId) ?? 0;
    },
    async refillPocketAfterFight(command: unknown) {
      inventory.refills.push(command);
    },
    async applyDeathDurability(command: unknown) {
      inventory.deaths.push(command);
      return { paperdollChanged: false };
    },
    async equippedSkillBonuses() {
      return [];
    },
  };
  return inventory as InventoryService & typeof inventory;
}

function fakeCatalog(): Catalog {
  const bot = playableHuntBot();
  const artifacts = new Map<number, ArtifactDefinition>(
    bot.reward.lootEntries.map((entry) => [
      entry.artikulId,
      testArtifact({
        id: entry.artikulId,
        title: `Loot ${entry.artikulId}`,
        picture: `loot_${entry.artikulId}.png`,
      }),
    ]),
  );
  return {
    artifact: async (id: number) => artifacts.get(id) ?? null,
    bot: async (id: number) => (id === bot.id ? bot : null),
    skill: async () => {
      throw new Error("unused");
    },
    level: async () => {
      throw new Error("unused");
    },
    appearance: async () => {
      throw new Error("unused");
    },
    hudDefaults: async () => {
      throw new Error("unused");
    },
    chrome: async () => {
      throw new Error("unused");
    },
    commonConf: async () =>
      ({
        rank_info: [
          { id: 0, title: "Простолюдин" },
          { id: 1, title: "Задира" },
        ],
        rank_table: [
          { rank: "0", honor: "0" },
          { rank: "1", honor: "100" },
        ],
      }) as never,
    storeTypes: async () => [],
    storeLots: async () => [],
    reputationTrack: async () => null,
    reputationTracks: async () => [],
    profession: async () => null,
    professions: async () => [],
    assistantType: async () => null,
    assistantTypes: async () => [],
    farmResource: async () => null,
    areaFarms: async () => [],
    craftRecipe: async () => null,
    craftRecipeByBook: async () => null,
    bonus: async () => null,
    useScript: async () => null,
  };
}
