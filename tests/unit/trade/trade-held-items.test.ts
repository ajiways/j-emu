import { describe, expect, it } from "vitest";
import type { TradeDeskDeps } from "../../../src/app/trade-desk.ts";
import { refundTradeHeldItems } from "../../../src/app/trade-held-refund.ts";
import { withdrawTradeItem } from "../../../src/app/trade-withdraw.ts";
import { MailBagFullError } from "../../../src/modules/inventory/domain/mail-bag-full-error.ts";
import { UNUPGRADED } from "../../../src/modules/inventory/domain/item-upgrade.ts";
import { TradeSessions } from "../../../src/modules/trade/application/trade-sessions.ts";
import { TradeDeniedError } from "../../../src/modules/trade/domain/trade-denied-error.ts";
import type { TradeItemSnapshot } from "../../../src/modules/trade/domain/trade-session.ts";
import { FakeHeldItemsRepository } from "../../support/fakes/fake-held-items-repository.ts";
import { testHero } from "../../support/hero-fixtures.ts";

const SNAP: TradeItemSnapshot = {
  originalItemId: 100_000,
  artifactId: 23,
  quantity: 1,
  durability: 0,
  durabilityMax: 0,
  upgrade: UNUPGRADED,
};

describe("trade held items", () => {
  it("merges quantity on the same hero and original item id", async () => {
    const held = new FakeHeldItemsRepository();
    await held.upsertAdd(1, SNAP);
    await held.upsertAdd(1, { ...SNAP, quantity: 2 });
    await held.upsertAdd(1, { ...SNAP, originalItemId: 100_001, quantity: 4 });
    const rows = await held.listAll();
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.originalItemId === 100_000)?.quantity).toBe(3);
    expect(rows.find((row) => row.originalItemId === 100_001)?.quantity).toBe(4);
  });

  it("withdraw without escrow throws the 204 Error path", async () => {
    const sessions = new TradeSessions();
    const hero = testHero({ id: 1, accountId: 10, nick: "Ada" });
    sessions.openRequest(
      { id: 1, accountId: 10, nick: "Ada", kind: 1, level: 1 },
      { id: 2, accountId: 20, nick: "Bob", kind: 1, level: 1 },
    );
    const trayId = sessions.requireOpen(1).mine.id;
    sessions.acceptInvite({ id: 2, accountId: 20, nick: "Bob", kind: 1, level: 1 }, trayId);
    sessions.requireOpen(1).mine.artifacts.set(SNAP.originalItemId, SNAP);
    const deps = {
      sessions,
      heldItems: new FakeHeldItemsRepository(),
      unitOfWork: { run: (work: () => Promise<unknown>) => work() },
      characters: { getByAccountId: async () => hero },
      inventory: {
        grantMailSnapshots: async () => {
          throw new Error("grant must not run without escrow");
        },
      },
    } as unknown as TradeDeskDeps;
    await expect(withdrawTradeItem(deps, 10, SNAP.originalItemId, 1)).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(TradeDeniedError);
        expect((error as Error).message).toMatch(/held item for hero 1 original 100000 is missing/);
        return true;
      },
    );
  });

  it("boot bag full leaves the row and still refunds other heroes", async () => {
    const held = new FakeHeldItemsRepository();
    await held.upsertAdd(1, SNAP);
    await held.upsertAdd(2, { ...SNAP, originalItemId: 100_002 });
    const granted: number[] = [];
    await refundTradeHeldItems({
      heldItems: held,
      inventory: {
        async grantMailSnapshots(command) {
          granted.push(command.characterId);
          if (command.characterId === 1) throw new MailBagFullError();
        },
      },
      unitOfWork: { run: (work) => work() },
    });
    expect(granted).toEqual([1, 2]);
    const left = await held.listAll();
    expect(left).toHaveLength(1);
    expect(left[0]?.heroId).toBe(1);
  });
});
