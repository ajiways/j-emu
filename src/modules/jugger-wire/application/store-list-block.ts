import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { StoreLot, StoreType } from "../../catalog/domain/store-lot.ts";
import { artifactSkillWireMap } from "./artifact-skill-wire.ts";
import { storeLotWire, type StoreLotWireBlock } from "./store-lot-wire.ts";

export type StoreListBlock = Readonly<{
  status: 100;
  types: Readonly<Record<string, Readonly<{ id: number; title: string; ord: number }>>>;
  artikuls: readonly StoreLotWireBlock[];
}>;

export async function buildStoreListBlock(
  catalog: Catalog,
  types: readonly StoreType[],
  lots: readonly StoreLot[],
): Promise<StoreListBlock> {
  const typeMap: Record<string, { id: number; title: string; ord: number }> = {};
  types.forEach((type, index) => {
    if (!type.title) throw new Error(`Store type ${type.typeId} title is required`);
    typeMap[String(index)] = { id: type.typeId, title: type.title, ord: type.ord };
  });
  const artikuls: StoreLotWireBlock[] = [];
  for (const lot of lots) {
    const artifact = await catalog.artifact(lot.artikulId);
    if (!artifact) {
      throw new Error(`Store lot ${lot.lotId} artifact ${lot.artikulId} is missing`);
    }
    artikuls.push(
      storeLotWire(lot, {
        id: artifact.id,
        title: artifact.title,
        picture: artifact.picture,
        kindId: artifact.kindId,
        slotMask: artifact.slotMask,
        levelMin: artifact.levelMin,
        levelMax: artifact.levelMax,
        flags: artifact.flags,
        skills: await artifactSkillWireMap(artifact.skills, catalog),
      }),
    );
  }
  return { status: 100, types: typeMap, artikuls };
}
