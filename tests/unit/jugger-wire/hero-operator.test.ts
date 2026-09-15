import { describe, expect, it } from "vitest";
import { Hero } from "../../../src/modules/character/domain/hero.ts";
import type { HeroRecord } from "../../../src/modules/character/domain/hero-record.ts";
import { InsufficientMoneyError } from "../../../src/modules/character/domain/insufficient-money-error.ts";
import { BagFullError } from "../../../src/modules/inventory/domain/bag-full-error.ts";
import { InventoryItem } from "../../../src/modules/inventory/domain/inventory-item.ts";
import { MissingArtifactError } from "../../../src/modules/inventory/domain/missing-artifact-error.ts";
import { HeroOperator } from "../../../src/modules/jugger-wire/application/hero-operator.ts";
import { HeroOperatorError } from "../../../src/modules/jugger-wire/application/hero-operator-error.ts";
import type { UnitOfWork } from "../../../src/shared/kernel/unit-of-work.ts";

const passthroughUow: UnitOfWork = {
  run: (work) => work(),
};

describe("HeroOperator error mapping", () => {
  it("returns 404 when the hero is missing", async () => {
    const operator = new HeroOperator(passthroughUow, characters(null), inventory());
    await expect(operator.state(9)).rejects.toMatchObject({
      status: 404,
      name: "HeroOperatorError",
    });
  });

  it("maps a missing catalog artifact to 404", async () => {
    const operator = new HeroOperator(
      passthroughUow,
      characters(sampleHero()),
      inventory({
        grantToBag: async () => {
          throw new MissingArtifactError(40404);
        },
      }),
    );
    await expect(operator.grantItem(1, 40404, 1)).rejects.toMatchObject({
      name: "HeroOperatorError",
      status: 404,
      message: "Artifact catalog entry 40404 is missing",
    });
  });

  it("maps a full bag to 409", async () => {
    const operator = new HeroOperator(
      passthroughUow,
      characters(sampleHero()),
      inventory({
        grantToBag: async () => {
          throw new BagFullError(1);
        },
      }),
    );
    await expect(operator.grantItem(1, 77, 1)).rejects.toMatchObject({
      name: "HeroOperatorError",
      status: 409,
      message: "Bag for hero 1 is full",
    });
  });

  it("maps insufficient money to 409", async () => {
    const operator = new HeroOperator(
      passthroughUow,
      characters(sampleHero(), {
        debitMoney: async () => {
          throw new InsufficientMoneyError(100, 101);
        },
      }),
      inventory(),
    );
    await expect(operator.adjustMoney(1, -101)).rejects.toMatchObject({
      name: "HeroOperatorError",
      status: 409,
      message: "Hero money 100 is below debit 101",
    });
  });

  it("maps money overflow to 409", async () => {
    const operator = new HeroOperator(
      passthroughUow,
      characters(sampleHero(), {
        creditMoney: async () => {
          throw new Error("Hero money overflow");
        },
      }),
      inventory(),
    );
    await expect(operator.adjustMoney(1, 1)).rejects.toMatchObject({
      name: "HeroOperatorError",
      status: 409,
      message: "Hero money overflow",
    });
  });

  it("does not swallow unexpected grant errors", async () => {
    const operator = new HeroOperator(
      passthroughUow,
      characters(sampleHero()),
      inventory({
        grantToBag: async () => {
          throw new Error("Inventory lock failed");
        },
      }),
    );
    await expect(operator.grantItem(1, 77, 1)).rejects.toThrow("Inventory lock failed");
    await expect(operator.grantItem(1, 77, 1)).rejects.not.toBeInstanceOf(HeroOperatorError);
  });
});

function sampleHero(): Hero {
  const record: HeroRecord = {
    id: 1,
    accountId: 1,
    nick: "Tester",
    level: 1,
    hp: 10,
    maxHp: 10,
    mp: 10,
    maxMp: 10,
    exp: 1,
    areaId: "503",
    moneyMinor: 100,
    moneyGoldMinor: 0,
    kind: 1,
    gender: 1,
    language: "ru",
    body: "body",
    sk: 0,
    honor: 0,
    hpTime: 0,
    regenAt: new Date("2026-09-07T12:00:00.000Z"),
    moveReadyAt: null,
    ghost: false,
    injuryTime: 0,
    injuryArtikulId: 0,
    instanceCopyId: null,
  };
  return Hero.restore(record);
}

function characters(
  hero: Hero | null,
  overrides: {
    creditMoney?: () => Promise<void>;
    debitMoney?: () => Promise<void>;
  } = {},
) {
  return {
    getById: async () => hero,
    creditMoney: overrides.creditMoney ?? (async () => undefined),
    debitMoney: overrides.debitMoney ?? (async () => undefined),
  };
}

function inventory(
  overrides: {
    grantToBag?: () => Promise<void>;
  } = {},
) {
  return {
    list: async () => [
      new InventoryItem(100_000, 1, 77, 4, { kind: "bag" }, 0, 0),
      new InventoryItem(100_001, 1, 93, 1, { kind: "pocket", position: 1 }, 0, 0),
      new InventoryItem(100_002, 1, 9095, 1, { kind: "equipment", slot: 2 }, 3, 3),
    ],
    grantToBag: overrides.grantToBag ?? (async () => undefined),
  };
}
