import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { PartyBagItem } from "../../party/domain/party-record.ts";
import { artifactSkillWireMap } from "./artifact-skill-wire.ts";
import { moneyNumberFromMinorUnits } from "./money-from-minor-units.ts";

export function emptyBagPayload(): Readonly<{
  status: 100;
  artikuls: readonly unknown[];
  types: readonly unknown[];
}> {
  return { status: 100, artikuls: [], types: [] };
}

function bagTypeTitle(typeId: string): string {
  if (typeId === "10") return "Еда";
  if (typeId === "67") return "Артефакты";
  return "Предметы";
}

export async function bagPayload(
  items: readonly PartyBagItem[],
  catalog: Catalog,
  opts: { newloot?: boolean } = {},
): Promise<Readonly<Record<string, unknown>>> {
  const artikuls: Array<Readonly<Record<string, unknown>>> = [];
  const typeMap = new Map<string, Readonly<Record<string, unknown>>>();
  for (const item of items) {
    const definition = await catalog.artifact(item.artikulId);
    if (!definition) throw new Error(`Artifact catalog entry ${item.artikulId} is missing`);
    const skills = await artifactSkillWireMap(definition.skills, catalog);
    artikuls.push({
      id: String(item.id),
      title: definition.title,
      description: "",
      picture: definition.picture,
      price: String(moneyNumberFromMinorUnits(definition.priceMinor)),
      quality: "0",
      kind_id: String(definition.kindId),
      type_id: String(definition.typeId),
      level_min: String(definition.levelMin),
      durability: String(definition.durability),
      durability_max: String(definition.durabilityMax),
      validity: "0",
      flags: definition.flags,
      slot_mask: String(definition.slotMask),
      companion_type: "0",
      trend: "0",
      cnt: String(item.cnt),
      remove_time: item.removeTime,
      artifact_skills: Object.keys(skills).length > 0 ? skills : [],
    });
    const typeId = String(definition.typeId);
    if (!typeMap.has(typeId)) {
      typeMap.set(typeId, {
        id: typeId,
        ord: "0",
        title: bagTypeTitle(typeId),
        description: "",
      });
    }
  }
  const out: Record<string, unknown> = {
    status: 100,
    artikuls,
    types: [...typeMap.values()],
  };
  if (opts.newloot) out.newloot = 1;
  return out;
}
