/**
 * Every effect skill (`effects[].skills[].skill_id`) the catalog uses, and whether combat applies it.
 * ADR-0021: an id missing here is a content error; a known but `deferred` one is logged when a fight
 * loads a spell that carries it, and the spell works without that part.
 */
type SkillSupport = "supported" | "deferred";
/** `owner` — confirmed by the project owner from game knowledge; `spell-text` — the spell description. */
type SkillEvidence = "live" | "owner" | "spell-text" | "old-server" | "name" | "unknown";

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
  STR: skill("Сила, плоская", "live", "supported", "supported"),
  pcSTR: skill("Сила, процент", "live", "supported", "supported"),
  DEX: skill(
    "Ловкость, плоская; запекается при касте (live 182: 19 и 23% -> 32)",
    "live",
    "supported",
  ),
  pcDEX: skill("Ловкость, процент; на wire множителем 1.23", "live", "supported"),
  DEF: skill("Стойкость (защита), плоская", "spell-text", "supported"),
  pcDEF: skill("Стойкость, процент", "spell-text", "supported"),
  RAG: skill("Неистовство (шанс крита), плоское", "spell-text", "supported"),
  pcRAG: skill("Неистовство, процент (старый сервер: 183 87 -> +43)", "old-server", "supported"),
  BLOK: skill("Блок, плоский показатель", "spell-text", "supported"),
  HPMAX: skill(
    "поднимает максимум HP; текущее растёт от лечения kind 2 того же спелла (live 169: HPMAX 39, heal 26% нового максимума 150 = 39)",
    "live",
    "supported",
  ),
  pcHPMAX: skill(
    "то же в процентах от базового максимума, запекается с округлением; на wire множителем 1.35",
    "live",
    "supported",
  ),
  MPMAX: skill(
    "максимум маны в бою, плоский; тратится спеллами и идолами, в бою не восстанавливается",
    "name",
    "supported",
  ),
  VIT: skill("неизвестно, описаний нет", "unknown"),
  pcVIT: skill("неизвестно, описаний нет", "unknown"),
  LUCK: skill(
    "инициатива: кто бьёт первым (у мобов в бестиарии называется так же)",
    "owner",
    "supported",
  ),
  CR: skill(
    "шанс крита ближайшего удара: 1 = всегда, меньше 1 = абсолютный шанс",
    "spell-text",
    "supported",
  ),
  pcCR: skill(
    "шанс крита, процентное изменение (минусы: «не соберётся с силами для мощного удара»)",
    "spell-text",
    "supported",
  ),
  CRBonus: skill(
    "прибавка к шансу крита в процентных пунктах (27 = 27%)",
    "spell-text",
    "supported",
  ),
  pcCRBonus: skill("прибавка к криту, процентное изменение", "spell-text", "supported"),
  BR: skill("шанс заблокировать физический удар, доля (0.05 = 5%)", "spell-text", "supported"),
  pcBR: skill("шанс блока у умений «Прикрытие», доля", "spell-text", "supported"),
  DFR: skill(
    "доля физического урона, которую цель не получает (0.32 -> 68%, 1 -> неуязвим); по dmgMask",
    "spell-text",
    "supported",
  ),
  MAG_DFR: skill("то же для магического урона", "spell-text", "supported"),
  ADFR: skill(
    "после всех расчётов итоговый входящий урон снижается на долю (1 = полностью)",
    "owner",
    "supported",
  ),
  DR: skill("абсолютный шанс уклонения, вместо стандартного, от ловкости", "owner", "supported"),
  DMG_AMP: skill("носитель получает больше урона на долю (0.23 = +23%)", "spell-text", "supported"),
  pcDMG_AMP: skill("то же в процентах", "spell-text", "supported"),
  VAMP: skill(
    "лечение носителя на долю ИТОГОВОГО урона его удара; минус = самоурон",
    "owner",
    "supported",
  ),
  pcVAMP: skill(
    "вампиризм в процентах, то же что VAMP (владелец); прибавляется к нему",
    "owner",
    "supported",
  ),
  ANTIVAMP: skill(
    "самоурон носителя на долю итогового урона его удара, ОТДЕЛЬНЫМ пакетом",
    "owner",
    "supported",
  ),
  ANTI_STUN: skill("иммунитет к стану на срок эффекта (100 = 100%)", "spell-text", "supported"),
  RAGE_MOD: skill(
    "прибавка к накоплению ярости, процент; действует на следующее получение урона",
    "owner",
    "supported",
  ),
  pcRAGE_MOD: skill(
    "то же, что RAGE_MOD, в процентах (владелец); прибавляется к нему",
    "owner",
    "supported",
  ),
  MAGSTR_ACD: skill("сила магии кислоты, плоская прибавка", "owner", "supported"),
  MAGSTR_DRK: skill("сила магии тьмы, плоская прибавка", "owner", "supported"),
  MAGSTR_FR: skill(
    "сила магии огня, плоская прибавка (2000 в данных = «+25» в тексте)",
    "owner",
    "supported",
  ),
  MAGSTR_ICE: skill("сила магии льда, плоская прибавка", "owner", "supported"),
  MAGSTR_LGH: skill("сила магии молнии, плоская прибавка", "owner", "supported"),
  MAGSTR_LTN: skill("сила магии света, плоская прибавка", "owner", "supported"),
  pcPET_STR: skill("сила питомца, процент (питомцы не моделируются)", "name"),
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
