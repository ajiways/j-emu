/**
 * Live fight pocket persSpells / effUse send flags "262144" when catalog
 * extra.spell.flags is omitted (Pub1 AMF drops the zero). Catalog 0/absent
 * is dump-proven; the wire value is FightRules, not a silent default.
 */
export const POCKET_SPELL_WIRE_FLAGS = "262144";

export function pocketSpellWireFlags(catalogFlags: string | undefined): string {
  if (catalogFlags !== undefined && catalogFlags !== "") return catalogFlags;
  return POCKET_SPELL_WIRE_FLAGS;
}
