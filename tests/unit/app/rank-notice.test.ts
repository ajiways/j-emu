import { describe, expect, it } from "vitest";
import { rankNotice } from "../../../src/app/rank-notice.ts";
import { honorRankCatalogFromConf } from "../../../src/modules/catalog/domain/honor-progress.ts";
import type { CommonConfBlock } from "../../../src/modules/content/domain/bootstrap-content.ts";

const conf = {
  rank_info: [
    { id: 0, title: "Простолюдин" },
    { id: 1, title: "Задира" },
    { id: 2, title: "Крепыш" },
    { id: 3, title: "Силач" },
    { id: 4, title: "Громила" },
  ],
  rank_table: [
    { rank: "0", honor: "0", description: "" },
    { rank: "1", honor: "100", description: "Доступно (у Веллоса Юла): [[IMG a]]" },
    { rank: "2", honor: "500", description: "" },
    { rank: "3", honor: "2500", description: "Изучение навыка." },
    { rank: "4", honor: "15000", description: "<b>С 8 уровня.</b> Доступно." },
  ],
} as unknown as CommonConfBlock;
const ranks = honorRankCatalogFromConf(conf);

describe("rankNotice", () => {
  it("shows the rank table text and says the next rank needs a higher level", () => {
    const notice = rankNotice({ conf, ranks, rank: 3, heroLevel: 6 });
    expect(notice.headline).toBe("Вы получили звание «Силач»!");
    expect(notice.body).toBe(
      "Изучение навыка.<br>Следующее звание <b>«Громила»</b> откроется с <b>8 уровня</b> (нужно 15000 героизма). Звания открываются вместе с уровнем.",
    );
  });

  it("shows only the honor need when the next rank is already open for the level", () => {
    const notice = rankNotice({ conf, ranks, rank: 1, heroLevel: 6 });
    expect(notice.body).toBe(
      "Доступно (у Веллоса Юла): [[IMG a]]<br>Следующее звание — <b>«Крепыш»</b>: нужно 500 героизма.",
    );
  });

  it("uses the next-rank line alone when the table text is empty and fails with no content", () => {
    expect(rankNotice({ conf, ranks, rank: 2, heroLevel: 6 }).body).toBe(
      "Следующее звание — <b>«Силач»</b>: нужно 2500 героизма.",
    );
    expect(() => rankNotice({ conf, ranks, rank: 4, heroLevel: 8 })).not.toThrow();
    expect(() => rankNotice({ conf, ranks, rank: 9, heroLevel: 8 })).toThrow(
      "rank_table 9 description is missing",
    );
  });
});
