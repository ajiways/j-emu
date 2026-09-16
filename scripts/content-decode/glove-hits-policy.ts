/**
 * Catalog extra.hits is dump-proven on glove 9095.
 * Pub1 AMF has socket rows on many paperdoll items but not hits
 * (instance-rolled in jgr-emu). Catalog extra.spells is published for
 * kind-44 gloves with sockets, including pool rows (`artikul_id0=0` plus
 * `artikul_id1..6`). 20546 keeps extra.spells unpublished so GEAR-01 stays
 * extra.spell-only until the CMB-02 combo leftover.
 */
export const GLOVE_CATALOG_HITS_ARTIKUL_ID = 9095;
export const GEAR_COMBO_GLOVE_ARTIKUL_ID = 20546;
export const GLOVE_CATALOG_HITS = [2, 3, 2, 3, 1, 2, 3, 1] as const;
