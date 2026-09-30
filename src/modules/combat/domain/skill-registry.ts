/**
 * Every effect skill (`effects[].skills[].skill_id`) the catalog uses, and whether combat applies it.
 * ADR-0021: an id missing here is a content error; a known but `deferred` one is logged when a fight
 * loads a spell that carries it, and the spell works without that part.
 */
type SkillSupport = "supported" | "deferred";
type SkillEvidence = "live" | "spell-text" | "old-server" | "name" | "unknown";

type SkillEntry = Readonly<{
  meaning: string;
  /** Effect kind 3 (standing buff/debuff): the skill changes the carrier. */
  buff: SkillSupport;
  /** Kinds 1, 2, 4, 5, 6: the skill is an input of that effect's own formula. */
  payload: SkillSupport;
  evidence: SkillEvidence;
}>;

const skill = (
  meaning: string,
  evidence: SkillEvidence,
  buff: SkillSupport = "deferred",
  payload: SkillSupport = "deferred",
): SkillEntry => ({ meaning, buff, payload, evidence });

export const SKILL_REGISTRY: Readonly<Record<string, SkillEntry>> = {
  STR: skill("strength, flat", "live", "supported", "supported"),
  pcSTR: skill("strength, percent", "live", "supported", "supported"),
  DEX: skill("dexterity, flat (baked at cast, live 182: 19+23% -> 32)", "live"),
  pcDEX: skill("dexterity, percent (sent as multiplier 1.23)", "live"),
  DEF: skill("defense, flat", "name"),
  pcDEF: skill("defense, percent", "name"),
  RAG: skill("rage stat (crit rating), flat", "name"),
  pcRAG: skill("rage stat, percent (old server: 183 87 -> +43)", "old-server"),
  BLOK: skill("block, flat", "name"),
  HPMAX: skill("max hp, flat (live 169: 35% of 111 -> +39, max 150)", "live"),
  pcHPMAX: skill("max hp, percent (sent as multiplier 1.35)", "live"),
  MPMAX: skill("max mana, flat", "name"),
  VIT: skill("vitality", "unknown"),
  pcVIT: skill("vitality, percent", "unknown"),
  LUCK: skill("luck", "unknown"),
  CR: skill("crit chance: 1 forces a crit, below 1 an absolute chance", "old-server"),
  pcCR: skill("crit chance, percent", "name"),
  CRBonus: skill("crit damage bonus, flat", "name"),
  pcCRBonus: skill("crit damage bonus, percent", "name"),
  BR: skill("unknown defensive rating", "unknown"),
  pcBR: skill("BR, percent", "unknown"),
  DFR: skill("damage taken factor: 0.4 means 60% taken (spell text of 6197)", "spell-text"),
  MAG_DFR: skill("magic damage taken factor, like DFR", "name"),
  ADFR: skill("unknown damage reduction variant", "unknown"),
  DR: skill("unknown damage resistance", "unknown"),
  DMG_AMP: skill("outgoing damage amplification", "name"),
  pcDMG_AMP: skill("outgoing damage amplification, percent", "name"),
  VAMP: skill("share of a hit healed to the attacker", "old-server"),
  pcVAMP: skill("VAMP, percent", "name"),
  ANTIVAMP: skill("share of a hit taken from the attacker", "old-server"),
  ANTI_STUN: skill("stun resistance", "name"),
  RAGE_MOD: skill("rage gain modifier", "name"),
  pcRAGE_MOD: skill("rage gain modifier, percent", "name"),
  MAGSTR_ACD: skill("acid school power", "name"),
  MAGSTR_DRK: skill("dark school power", "name"),
  MAGSTR_FR: skill("fire school power", "name"),
  MAGSTR_ICE: skill("ice school power", "name"),
  MAGSTR_LGH: skill("lightning school power", "name"),
  MAGSTR_LTN: skill("light school power", "name"),
  pcPET_STR: skill("pet strength, percent (pets are not modelled)", "name"),
};

const BUFF_KIND = 3;
const PAYLOAD_KINDS: ReadonlySet<number> = new Set([1, 2, 4, 5, 6]);

/** Whether combat applies `skillId` as carried by an effect of `effectKind`; unknown ids throw. */
export function skillSupport(skillId: string, effectKind: number): SkillSupport {
  const entry = SKILL_REGISTRY[skillId];
  if (!entry) throw new Error(`Effect skill ${skillId} is not in the skill registry`);
  if (effectKind === BUFF_KIND) return entry.buff;
  if (PAYLOAD_KINDS.has(effectKind)) return entry.payload;
  throw new Error(`Effect kind ${effectKind} carries skill ${skillId} but has no skill context`);
}
