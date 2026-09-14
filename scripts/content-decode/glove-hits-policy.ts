/**
 * Catalog extra.hits is dump-proven on glove 9095.
 * Pub1 AMF has socket rows on many paperdoll items but not hits
 * (instance-rolled in jgr-emu). Attaching this sequence to every socketed
 * artikul would activate CMB-02 glove loadout on GEAR-01 20546.
 * Only 9095 publishes extra.spells + this hits policy.
 */
export const GLOVE_CATALOG_HITS_ARTIKUL_ID = 9095;
export const GLOVE_CATALOG_HITS = [2, 3, 2, 3, 1, 2, 3, 1] as const;
