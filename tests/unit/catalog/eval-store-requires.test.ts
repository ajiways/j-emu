import { describe, expect, it } from "vitest";
import {
  storeEntryDeny,
  storeRequiresDeny,
} from "../../../src/modules/catalog/domain/eval-store-requires.ts";
import { honorRankCatalogFromConf } from "../../../src/modules/catalog/domain/honor-progress.ts";
import { parseStoreRequires } from "../../../src/modules/catalog/domain/store-requires.ts";
import type { CommonConfBlock } from "../../../src/modules/content/domain/bootstrap-content.ts";

const ranks = honorRankCatalogFromConf({
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
} as CommonConfBlock);

const catalog = {
  ranks,
  reputationTitle: (objectId: number) => {
    if (objectId !== 5) throw new Error(`Reputation track ${objectId} is missing`);
    return "Репутация Радвея";
  },
};

describe("storeRequiresDeny", () => {
  it("denies RANK with the dump-proven zвание plaque", () => {
    const requires = parseStoreRequires({ all: [{ type: "RANK", min: 4 }] });
    expect(
      storeRequiresDeny(requires, { level: 1, honor: 0, reputations: new Map() }, catalog),
    ).toBe("Нужно звание «Громила».");
  });

  it("denies REPUTATION with the short track title", () => {
    const requires = parseStoreRequires({
      all: [{ type: "REPUTATION", object_id: 5, min: 2500 }],
    });
    expect(
      storeRequiresDeny(requires, { level: 6, honor: 0, reputations: new Map() }, catalog),
    ).toBe("Нужно 2500 репутации Радвея.");
  });

  it("denies LEVEL without a rank/reputation plaque", () => {
    const requires = parseStoreRequires({ all: [{ type: "LEVEL", min: 7 }] });
    expect(
      storeRequiresDeny(requires, { level: 1, honor: 0, reputations: new Map() }, catalog),
    ).toBe("Нельзя купить этот товар.");
  });

  it("fails closed on an unknown require type", () => {
    expect(() => parseStoreRequires({ all: [{ type: "FLAG", min: 1 }] })).toThrow(
      /type FLAG is not supported/,
    );
  });

  it("uses the authored come-in plaque for a LEVEL entry gate", () => {
    const requires = parseStoreRequires({ all: [{ type: "LEVEL", min: 7 }] });
    expect(
      storeEntryDeny(
        requires,
        "Сюда нельзя.",
        { level: 1, honor: 0, reputations: new Map() },
        catalog,
      ),
    ).toBe("Сюда нельзя.");
  });

  it("falls back to the dump-proven come-in plaque when deny_error is empty", () => {
    const requires = parseStoreRequires({ all: [{ type: "LEVEL", min: 7 }] });
    expect(
      storeEntryDeny(requires, "", { level: 1, honor: 0, reputations: new Map() }, catalog),
    ).toBe("Сюда нельзя войти.");
  });
});
