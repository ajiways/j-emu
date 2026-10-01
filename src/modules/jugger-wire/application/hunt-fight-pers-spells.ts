import type {
  CombatIdolRow,
  CombatLoadout,
  CombatPocketRow,
} from "../../combat/domain/combat-loadout.ts";
import { pocketSpellWireFlags } from "../../combat/domain/pocket-spell-wire-flags.ts";
import { huntNativePersSpells } from "./hunt-native-pers-spells.ts";

const IDOL_WIRE_FLAGS = "48";

export function huntPersSpellsEvent(
  loadout: CombatLoadout,
  aggroCount: number,
): Readonly<Record<string, unknown>> {
  const native = huntNativePersSpells(aggroCount);
  const extras = [
    ...pocketSpells(loadout.pocket),
    ...idolSpells(loadout.idols),
    ...gloveSpells(loadout),
  ];
  if (extras.length === 0) return native;
  const merged: Record<string, unknown> = { ...native };
  let index = Object.keys(native).filter((key) => key !== "et").length;
  for (const spell of extras) {
    index += 1;
    merged[String(index)] = spell;
  }
  return merged;
}

function pocketSpells(
  rows: readonly CombatPocketRow[],
): readonly Readonly<Record<string, unknown>>[] {
  return rows.map((row) => {
    if (!row.spell.persRestr) throw new Error(`Pocket item ${row.itemId} persRestr is required`);
    if (!row.spell.targetRestr)
      throw new Error(`Pocket item ${row.itemId} targetRestr is required`);
    return {
      artikulId: row.artifactId,
      ...(row.spell.cooldown !== undefined ? { cooldown: row.spell.cooldown } : {}),
      count: row.count,
      flags: pocketSpellWireFlags(row.spell.flags),
      ...(row.spell.groupId !== undefined ? { groupId: row.spell.groupId } : {}),
      ...(row.spell.mpCost !== undefined ? { mpCost: row.spell.mpCost } : {}),
      img: row.picture,
      persRestr: row.spell.persRestr,
      srcId: row.itemId,
      srcType: 2,
      targetRestr: row.spell.targetRestr,
      title: row.title,
    };
  });
}

/** Idols ride the bag-source `srcType 4` with the fixed flags the live client showed. */
function idolSpells(rows: readonly CombatIdolRow[]): readonly Readonly<Record<string, unknown>>[] {
  return rows.map((row) => {
    if (!row.spell.persRestr) throw new Error(`Idol item ${row.itemId} persRestr is required`);
    if (!row.spell.targetRestr) throw new Error(`Idol item ${row.itemId} targetRestr is required`);
    if (row.spell.mpCost === undefined)
      throw new Error(`Idol item ${row.itemId} mpCost is required`);
    return {
      artikulId: row.artifactId,
      count: row.count,
      flags: IDOL_WIRE_FLAGS,
      img: row.picture,
      mpCost: row.spell.mpCost,
      persRestr: row.spell.persRestr,
      srcId: row.itemId,
      srcType: 4,
      targetRestr: row.spell.targetRestr,
      title: row.title,
    };
  });
}

function gloveSpells(loadout: CombatLoadout): readonly Readonly<Record<string, unknown>>[] {
  if (!loadout.glove) return [];
  return loadout.glove.spells.map((spell) => {
    if (!spell.spell.persRestr) {
      throw new Error(`Glove spell ${spell.artikulId} persRestr is required`);
    }
    if (!spell.spell.targetRestr) {
      throw new Error(`Glove spell ${spell.artikulId} targetRestr is required`);
    }
    return {
      artikulId: spell.artikulId,
      cpCost: spell.cost,
      cpRow: spell.row,
      ...(spell.spell.cooldown !== undefined ? { cooldown: spell.spell.cooldown } : {}),
      ...(spell.spell.groupId !== undefined ? { groupId: spell.spell.groupId } : {}),
      ...(spell.spell.mpCost !== undefined ? { mpCost: spell.spell.mpCost } : {}),
      img: spell.picture,
      persRestr: spell.spell.persRestr,
      srcId: spell.artikulId,
      srcType: 3,
      targetRestr: spell.spell.targetRestr,
      title: spell.title,
    };
  });
}
