import type { ProfessionDocument } from "../../content/domain/content-profession.ts";
import type { ProfessionDefinition } from "./profession-definition.ts";

export type ProfessionInfoWire = Readonly<{
  id: number;
  title: string;
  type: 1 | 2;
  skill_id: string;
  picture: string;
  position: number;
  skill_step_override: number | false;
  skill_minlvl_override: number | false;
  description: string;
  info_url: string;
  user_stat_id?: number;
}>;

export function professionInfoFromDocuments(
  rows: readonly ProfessionDocument[],
): Readonly<Record<string, ProfessionInfoWire>> {
  return Object.fromEntries(
    [...rows]
      .sort((left, right) => left.id - right.id)
      .map((row) => [String(row.id), professionRowToWire(row)]),
  );
}

function professionRowToWire(row: ProfessionDocument | ProfessionDefinition): ProfessionInfoWire {
  const out: ProfessionInfoWire = {
    id: row.id,
    title: row.title,
    type: row.type,
    skill_id: row.skillId,
    picture: row.picture,
    position: row.position,
    skill_step_override: overrideToWire(row.skillStepOverride),
    skill_minlvl_override: overrideToWire(row.skillMinlvlOverride),
    description: row.description,
    info_url: row.infoUrl,
  };
  if (row.userStatId !== null) {
    return { ...out, user_stat_id: row.userStatId };
  }
  return out;
}

function overrideToWire(value: number | null): number | false {
  return value === null ? false : value;
}
