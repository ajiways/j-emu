import type { ReputationCatalog } from "../../catalog/ports/reputation-catalog.ts";
import type { HeroReputationRow } from "../../character/ports/character-reputation.ts";
import { ProtocolError } from "./protocol-error.ts";

type NamedUserStatRow = Readonly<{
  title: string;
  value: number;
  type: number;
  type_id: "13";
  object_id: string;
  weight: "0";
  image: string;
  status: 0;
}>;

export type UserStatsBlock = Readonly<{
  status: 100;
  stats: readonly NamedUserStatRow[];
  farm_stats: readonly unknown[];
  fish_stats: readonly unknown[];
}>;

export async function buildUserStatsBlock(
  hero: Readonly<{ exp: number; honor: number }>,
  reputations: readonly HeroReputationRow[],
  catalog: ReputationCatalog,
): Promise<UserStatsBlock> {
  const tracks = await catalog.reputationTracks();
  const byId = new Map(tracks.map((track) => [track.objectId, track]));
  const faction: NamedUserStatRow[] = [];
  let total = 0;
  for (const row of reputations) {
    if (!Number.isInteger(row.value) || row.value < 0) {
      throw new ProtocolError(204, `Hero reputation ${row.objectId} is invalid`);
    }
    if (row.value === 0) continue;
    const track = byId.get(row.objectId);
    if (!track) {
      throw new ProtocolError(204, `Reputation track ${row.objectId} is not published`);
    }
    if (!track.title) {
      throw new ProtocolError(204, `Reputation track ${row.objectId} title is required`);
    }
    if (!track.image) {
      throw new ProtocolError(204, `Reputation track ${row.objectId} image is required`);
    }
    faction.push(namedStat(track.title, row.value, row.objectId, 2, track.image));
    total += row.value;
  }
  return {
    status: 100,
    stats: [
      namedStat("Опыт", hero.exp, 1, 1, ""),
      namedStat("Героизм", hero.honor, 2, 1, ""),
      namedStat("Убито врагов", 0, 3, 1, ""),
      namedStat("Количество побед в дуэлях", 0, 4, 1, ""),
      namedStat("Казни", 0, 8, 1, ""),
      ...faction,
      namedStat("Суммарная репутация", total, 36, 3, ""),
      namedStat("Убито врагов за день", 0, 49, 1, ""),
    ],
    farm_stats: [],
    fish_stats: [],
  };
}

function namedStat(
  title: string,
  value: number,
  objectId: number,
  type: number,
  image: string,
): NamedUserStatRow {
  return {
    title,
    value,
    type,
    type_id: "13",
    object_id: String(objectId),
    weight: "0",
    image,
    status: 0,
  };
}
