import type {
  CombatIdolRow,
  CombatLoadout,
  CombatPocketRow,
} from "../../combat/domain/combat-loadout.ts";
import { pocketSpellWireFlags } from "../../combat/domain/pocket-spell-wire-flags.ts";
import { huntNativePersSpells } from "./hunt-native-pers-spells.ts";

const IDOL_WIRE_FLAGS = "48";
const MELEE_STRIKES = 3;

export function huntPersSpellsEvent(
  loadout: CombatLoadout,
  aggroCount: number | null,
): Readonly<Record<string, unknown>> {
  const native = huntNativePersSpells(aggroCount);
  const melee = Object.keys(native)
    .filter((key) => key !== "et")
    .sort((left, right) => Number(left) - Number(right))
    .map((key) => native[key]);
  // The live order: the three strikes, the pocket, the idols, then rage, back strike, aggro, glove.
  const ordered = [
    ...melee.slice(0, MELEE_STRIKES),
    ...pocketSpells(loadout.pocket),
    ...idolSpells(loadout.idols),
    ...melee.slice(MELEE_STRIKES),
    ...gloveSpells(loadout),
  ];
  const event: Record<string, unknown> = { et: "persSpells" };
  ordered.forEach((spell, index) => {
    event[String(index + 1)] = spell;
  });
  return event;
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
    return {
      artikulId: row.artifactId,
      count: row.count,
      flags: IDOL_WIRE_FLAGS,
      img: row.picture,
      // A free idol («Колдовской», no mana price) carries no mpCost, like any other free spell.
      ...(row.spell.mpCost !== undefined ? { mpCost: row.spell.mpCost } : {}),
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
