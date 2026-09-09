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

describe("HuntFightSettlement", () => {
  const bot = playableHuntBot();
  const minMoneyMinor = goldToMinor(bot.reward.moneyMin);
  const minMoneyWire = goldWireString(minMoneyMinor);

  it("grants EXP/money/loot on win once and skips them on loss", async () => {
    const characters = recordingCharacters();
    const inventory = recordingInventory();
    const settlement = new HuntFightSettlement(
      identityUow(),
      fakeCatalog(),
      characters,
      inventory,
      new SequenceRandom([0, 0, 0, 0]),
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
    const again = await settlement.persistFinished(outcome("win", 27, 20));
    expect(again.get(10)).toEqual(win.get(10));
    expect(characters.notes).toEqual([]);
    expect(characters.grants).toEqual([]);

    const lossCharacters = recordingCharacters();
    const lossInventory = recordingInventory();
    const loss = new HuntFightSettlement(
      identityUow(),
      fakeCatalog(),
      lossCharacters,
      lossInventory,
      new SequenceRandom([0, 0, 0, 0]),
    );
    const lost = await loss.persistFinished(outcome("loss", 0, 20));
    expect(lossCharacters.notes).toEqual([]);
    expect(lossCharacters.defeats).toEqual([{ characterId: 1, hp: 0 }]);
    expect(lossCharacters.grants).toEqual([]);
    expect(lossCharacters.credits).toEqual([]);
    expect(lossInventory.deaths).toHaveLength(1);
    expect(lost.get(10)).toMatchObject({ experience: 0, money: "0", loot: [] });
  });

  it("splits EXP by damage and gives loot only to the top damager", async () => {
    const characters = recordingCharacters();
    const settlement = new HuntFightSettlement(
      identityUow(),
      fakeCatalog(),
      characters,
      recordingInventory(),
      new SequenceRandom([0, 0, 0, 0]),
    );
    const result = await settlement.persistFinished({
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
});

function outcome(kind: "win" | "loss", hp: number, damageToBot: number): FightOutcomeSnapshot {
  const bot = playableHuntBot();
  return {
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
    level: 1,
    hp,
    damageToBot,
    leftLive: false,
    pocket: [],
  };
}

function identityUow(): UnitOfWork {
  return { run: (work) => work() };
}

function recordingCharacters() {
  return {
    notes: [] as Array<{ characterId: number; hp: number }>,
    defeats: [] as Array<{ characterId: number; hp: 0 }>,
    grants: [] as Array<{ characterId: number; operationId: string; amount: number }>,
    credits: [] as Array<{ characterId: number; minorUnits: number }>,
    async noteHp(command: { characterId: number; hp: number }) {
      this.notes.push(command);
      return snapshot(command.characterId, command.hp);
    },
    async noteMp() {
      throw new Error("unused");
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
    async creditMoney(command: { characterId: number; minorUnits: number }) {
      this.credits.push(command);
    },
    async debitMoney() {
      throw new Error("unused");
    },
    async lockById() {
      throw new Error("unused");
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

function recordingInventory() {
  const inventory = {
    refills: [] as unknown[],
    grants: [] as unknown[],
    deaths: [] as unknown[],
    async grantToBag(command: unknown) {
      inventory.grants.push(command);
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
    commonConf: async () => {
      throw new Error("unused");
    },
    storeTypes: async () => [],
    storeLots: async () => [],
    reputationTrack: async () => null,
    reputationTracks: async () => [],
    bonus: async () => null,
    useScript: async () => null,
  };
}
