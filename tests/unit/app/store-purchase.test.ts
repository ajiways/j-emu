import { describe, expect, it } from "vitest";
import { StoreDeniedError } from "../../../src/app/store-denied-error.ts";
import { StoreGateError } from "../../../src/app/store-gate-error.ts";
import { StorePurchase } from "../../../src/app/store-purchase.ts";
import type { Catalog } from "../../../src/modules/catalog/ports/catalog.ts";
import type { CommonConfBlock } from "../../../src/modules/content/domain/bootstrap-content.ts";
import type { StoreLot } from "../../../src/modules/catalog/domain/store-lot.ts";
import { InsufficientDiamondsError } from "../../../src/modules/character/domain/insufficient-diamonds-error.ts";
import type { InventoryService } from "../../../src/modules/inventory/domain/inventory-service.ts";
import type { WorldService } from "../../../src/modules/world/domain/world-service.ts";
import { Area } from "../../../src/modules/world/domain/area.ts";
import { testHero } from "../../support/hero-fixtures.ts";
import { testArtifact } from "../../support/artifact-fixtures.ts";

const ranksConf = {
  rank_info: [
    { id: 0, title: "Простолюдин" },
    { id: 1, title: "Задира" },
    { id: 2, title: "Крепыш" },
    { id: 3, title: "Силач" },
    { id: 4, title: "Громила" },
  ],
  rank_table: [
    { rank: "0", honor: "0" },
    { rank: "1", honor: "100" },
    { rank: "2", honor: "500" },
    { rank: "3", honor: "2500" },
    { rank: "4", honor: "15000" },
  ],
} as CommonConfBlock;

function goldLot(): StoreLot {
  return {
    areaId: "504",
    lotId: 80,
    artikulId: 23,
    typeId: -131,
    price: 1,
    ord: 8,
    pay: { currency: "gold", amount: 1 },
    requires: null,
  };
}

function barterLot(): StoreLot {
  return {
    areaId: "829",
    lotId: 4327,
    artikulId: 23,
    typeId: 2,
    price: 0,
    ord: 0,
    pay: { currency: "barter", artikulId: 77, count: 2 },
    requires: null,
  };
}

function rankLot(): StoreLot {
  return {
    areaId: "552",
    lotId: 438,
    artikulId: 621,
    typeId: 11,
    price: 300,
    ord: 0,
    pay: { currency: "gold", amount: 300 },
    requires: { all: [{ type: "RANK", min: 4 }] },
  };
}

describe("StorePurchase", () => {
  it("consumes barter stacks by catalog artifactId, not instance id", async () => {
    const consumed: Array<{ artifactId: number; quantity: number }> = [];
    const purchase = new StorePurchase(
      { run: async (work) => work() },
      {
        lockById: async () => testHero({ areaId: "829" }),
        reputations: async () => [],
        debitMoney: async () => {
          throw new Error("gold debit must not run for artifact barter");
        },
        debitMoneyGold: async () => {
          throw new Error("diamond debit must not run for artifact barter");
        },
      },
      {
        countBagByArtifact: async () => 5,
        consumeFromBag: async (command: {
          characterId: number;
          artifactId: number;
          quantity: number;
        }) => {
          consumed.push(command);
        },
        grantToBag: async () => undefined,
      } as unknown as InventoryService,
      fakeCatalog([barterLot()], [testArtifact({ id: 77, title: "Кусок мяса", bagStack: 99 })]),
      fakeWorld("829"),
    );
    await purchase.buy({
      characterId: 1,
      areaId: "829",
      lines: [{ key: "4327", count: 1 }],
    });
    expect(consumed).toEqual([{ characterId: 1, artifactId: 77, quantity: 2 }]);
  });

  it("does not treat a bag instance id as the barter artikul", async () => {
    const purchase = new StorePurchase(
      { run: async (work) => work() },
      {
        lockById: async () => testHero({ areaId: "829" }),
        reputations: async () => [],
        debitMoney: async () => undefined,
        debitMoneyGold: async () => undefined,
      },
      {
        countBagByArtifact: async (command: { artifactId: number }) =>
          command.artifactId === 77 ? 0 : 99,
        consumeFromBag: async () => {
          throw new Error("must not consume when catalog artikul is short");
        },
        grantToBag: async () => undefined,
      } as unknown as InventoryService,
      fakeCatalog([barterLot()], [testArtifact({ id: 77, title: "Кусок мяса", bagStack: 99 })]),
      fakeWorld("829"),
    );
    await expect(
      purchase.buy({ characterId: 1, areaId: "829", lines: [{ key: "4327", count: 1 }] }),
    ).rejects.toEqual(new StoreDeniedError("Недостаточно: Кусок мяса"));
  });

  it("denies a RANK lot with status-gate text before charging gold", async () => {
    const purchase = new StorePurchase(
      { run: async (work) => work() },
      {
        lockById: async () => testHero({ areaId: "552", honor: 0, level: 1 }),
        reputations: async () => [],
        debitMoney: async () => {
          throw new Error("RANK deny must not debit gold");
        },
        debitMoneyGold: async () => undefined,
      },
      { grantToBag: async () => undefined } as unknown as InventoryService,
      fakeCatalog([rankLot()], []),
      fakeWorld("552"),
    );
    await expect(
      purchase.buy({ characterId: 1, areaId: "552", lines: [{ key: "438", count: 1 }] }),
    ).rejects.toEqual(new StoreGateError("Нужно звание «Громила»."));
  });

  it("still debits gold for an ungated gold lot", async () => {
    const debits: number[] = [];
    const grants: Array<{ artifactId: number; quantity: number }> = [];
    const purchase = new StorePurchase(
      { run: async (work) => work() },
      {
        lockById: async () => testHero({ areaId: "504" }),
        reputations: async () => [],
        debitMoney: async (command: { minorUnits: number }) => {
          debits.push(command.minorUnits);
        },
        debitMoneyGold: async () => undefined,
      },
      {
        grantToBag: async (command: {
          characterId: number;
          artifactId: number;
          quantity: number;
        }) => {
          grants.push(command);
        },
      } as unknown as InventoryService,
      fakeCatalog([goldLot()], []),
      fakeWorld("504"),
    );
    await purchase.buy({ characterId: 1, areaId: "504", lines: [{ key: "80", count: 1 }] });
    expect(debits).toEqual([100]);
    expect(grants).toEqual([{ characterId: 1, artifactId: 23, quantity: 1 }]);
  });

  it("maps a diamond shortage to Недостаточно алмазов", async () => {
    const purchase = new StorePurchase(
      { run: async (work) => work() },
      {
        lockById: async () => testHero({ areaId: "504", moneyGoldMinor: 0 }),
        reputations: async () => [],
        debitMoney: async () => undefined,
        debitMoneyGold: async () => {
          throw new InsufficientDiamondsError(0, 100);
        },
      },
      { grantToBag: async () => undefined } as unknown as InventoryService,
      fakeCatalog(
        [
          {
            areaId: "504",
            lotId: 80,
            artikulId: 23,
            typeId: -131,
            price: 0,
            ord: 8,
            pay: { currency: "diamond", amount: 1 },
            requires: null,
          },
        ],
        [],
      ),
      fakeWorld("504"),
    );
    await expect(
      purchase.buy({ characterId: 1, areaId: "504", lines: [{ key: "80", count: 1 }] }),
    ).rejects.toEqual(new StoreDeniedError("Недостаточно алмазов"));
  });
});

function fakeWorld(areaId: string): WorldService {
  return {
    area: async () =>
      new Area(
        areaId,
        "Shop",
        "map.swf",
        "2_1",
        "radvei_map.swf",
        0,
        "store",
        "",
        "",
        "",
        "",
        0,
        0,
        0,
        0,
        0,
        0,
        "",
        [],
      ),
  } as unknown as WorldService;
}

function fakeCatalog(
  lots: readonly StoreLot[],
  artifacts: readonly ReturnType<typeof testArtifact>[],
): Catalog {
  return {
    commonConf: async () => ranksConf,
    storeLots: async () => lots,
    artifact: async (id: number) => artifacts.find((row) => row.id === id) ?? null,
    reputationTrack: async () => null,
  } as unknown as Catalog;
}
