import { describe, expect, it } from "vitest";
import {
  honorCapForLevel,
  honorProgress,
  honorRankCatalogFromConf,
  honorRankTitle,
} from "../../../src/modules/catalog/domain/honor-progress.ts";
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

describe("honorProgress", () => {
  it("maps honor 0 at level 6 to Простолюдин window 0…100", () => {
    expect(honorProgress(ranks, 0, 6)).toEqual({
      rank: 0,
      title: "Простолюдин",
      honor: 0,
      honorMin: 0,
      honorMax: 100,
      honorStatus: 0,
    });
  });

  it("reaches Задира at 100 honor when the level cap allows it", () => {
    expect(honorProgress(ranks, 100, 6)).toEqual({
      rank: 1,
      title: "Задира",
      honor: 100,
      honorMin: 100,
      honorMax: 500,
      honorStatus: 0,
    });
  });

  it("caps L6 and L7 at Силач 2500", () => {
    expect(honorCapForLevel(ranks, 6)).toBe(2500);
    expect(honorCapForLevel(ranks, 7)).toBe(2500);
    expect(honorProgress(ranks, 20_000, 6)).toMatchObject({
      rank: 3,
      title: "Силач",
      honor: 2500,
      honorMin: 2500,
      honorMax: 2500,
      honorStatus: 1,
    });
  });

  it("does not grant Громила before level 8", () => {
    expect(honorProgress(ranks, 20_000, 6).rank).toBe(3);
    expect(honorProgress(ranks, 20_000, 8).rank).toBe(4);
  });

  it("fails closed when a rank title is missing", () => {
    expect(() => honorRankTitle(ranks, 9)).toThrow(/Honor rank 9 is missing/);
  });

  it("accepts dump rank_info longer than rank_table", () => {
    const catalog = honorRankCatalogFromConf({
      rank_info: [
        { id: 0, title: "Простолюдин" },
        { id: 1, title: "Задира" },
        { id: 2, title: "Крепыш" },
      ],
      rank_table: [
        { rank: "0", honor: "0" },
        { rank: "1", honor: "100" },
      ],
    } as CommonConfBlock);
    expect(honorProgress(catalog, 100, 6)).toMatchObject({ rank: 1, title: "Задира" });
    expect(honorRankTitle(catalog, 2)).toBe("Крепыш");
  });
});
