import {
  honorRankTitle,
  minLevelForRank,
  type HonorRankCatalog,
} from "../modules/catalog/domain/honor-progress.ts";
import type { CommonConfBlock } from "../modules/content/domain/bootstrap-content.ts";

export type RankNotice = Readonly<{ headline: string; body: string }>;

/** Built from the client-visible rank table (`rank_table.description`) plus the next rank hint. */
export function rankNotice(input: {
  conf: CommonConfBlock;
  ranks: HonorRankCatalog;
  rank: number;
  heroLevel: number;
}): RankNotice {
  const table = input.conf.rank_table;
  if (!Array.isArray(table)) throw new Error("common_conf.rank_table must be an array");
  const row = table[input.rank] as { description?: unknown } | undefined;
  if (!row || typeof row.description !== "string") {
    throw new Error(`rank_table ${input.rank} description is missing`);
  }
  const lines: string[] = [];
  if (row.description !== "") lines.push(row.description);
  const nextTitle = input.ranks.titles[input.rank + 1];
  const nextHonor = input.ranks.honorToReach[input.rank + 1];
  if (nextTitle !== undefined && nextHonor !== undefined) {
    const needLevel = minLevelForRank(input.rank + 1);
    lines.push(
      needLevel > input.heroLevel
        ? `Следующее звание <b>«${nextTitle}»</b> откроется с <b>${needLevel} уровня</b> (нужно ${nextHonor} героизма). Звания открываются вместе с уровнем.`
        : `Следующее звание — <b>«${nextTitle}»</b>: нужно ${nextHonor} героизма.`,
    );
  }
  if (lines.length === 0) throw new Error(`Rank ${input.rank} notice has no content`);
  return {
    headline: `Вы получили звание «${honorRankTitle(input.ranks, input.rank)}»!`,
    body: lines.join("<br>"),
  };
}
