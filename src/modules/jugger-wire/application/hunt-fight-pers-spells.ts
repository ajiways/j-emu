import type { CombatLoadout, CombatPocketRow } from "../../combat/domain/combat-loadout.ts";
import { pocketSpellWireFlags } from "../../combat/domain/pocket-spell-wire-flags.ts";
import { huntNativePersSpells } from "./hunt-native-pers-spells.ts";

export function huntPersSpellsEvent(
  loadout: CombatLoadout,
  aggroCount: number,
): Readonly<Record<string, unknown>> {
  const native = huntNativePersSpells(aggroCount);
  const extras = [...pocketSpells(loadout.pocket), ...gloveSpells(loadout)];
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
      img: row.picture,
      persRestr: row.spell.persRestr,
      srcId: row.itemId,
      srcType: 2,
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
      ...(spell.spell.groupId !== undefined ? { groupId: spell.spell.groupId } : {}),
      img: spell.picture,
      persRestr: spell.spell.persRestr,
      srcId: spell.artikulId,
      srcType: 3,
      targetRestr: spell.spell.targetRestr,
      title: spell.title,
    };
  });
}
