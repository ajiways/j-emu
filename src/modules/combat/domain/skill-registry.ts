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
  DEX: skill("Ловкость, плоская; запекается при касте (live 182: 19 и 23% -> 32)", "live"),
  pcDEX: skill("Ловкость, процент; на wire множителем 1.23", "live"),
  DEF: skill("Стойкость (защита), плоская", "spell-text"),
  pcDEF: skill("Стойкость, процент", "spell-text"),
  RAG: skill("Неистовство (шанс крита), плоское", "spell-text"),
  pcRAG: skill("Неистовство, процент (старый сервер: 183 87 -> +43)", "old-server"),
  BLOK: skill("Блок, плоский показатель", "spell-text"),
  HPMAX: skill(
    "максимум и ТЕКУЩЕЕ HP растут на одну величину (лечит и поднимает максимум)",
    "owner",
  ),
  pcHPMAX: skill("то же в процентах от максимума; на wire множителем 1.35", "owner"),
  MPMAX: skill("максимум маны, плоский", "name"),
  VIT: skill("неизвестно, описаний нет", "unknown"),
  pcVIT: skill("неизвестно, описаний нет", "unknown"),
  LUCK: skill("инициатива: кто бьёт первым (у мобов в бестиарии называется так же)", "owner"),
  CR: skill("шанс крита ближайшего удара: 1 = всегда, меньше 1 = абсолютный шанс", "spell-text"),
  pcCR: skill(
    "шанс крита, процентное изменение (минусы: «не соберётся с силами для мощного удара»)",
    "spell-text",
  ),
  CRBonus: skill("прибавка к шансу крита в процентных пунктах (27 = 27%)", "spell-text"),
  pcCRBonus: skill("прибавка к криту, процентное изменение", "spell-text"),
  BR: skill("шанс заблокировать физический удар, доля (0.05 = 5%)", "spell-text"),
  pcBR: skill("шанс блока у умений «Прикрытие», доля", "spell-text"),
  DFR: skill(
    "доля физического урона, которую цель не получает (0.32 -> 68%, 1 -> неуязвим); по dmgMask",
    "spell-text",
  ),
  MAG_DFR: skill("то же для магического урона", "spell-text"),
  ADFR: skill(
    "после всех расчётов итоговый входящий урон снижается на долю (1 = полностью)",
    "owner",
  ),
  DR: skill("абсолютный шанс уклонения, вместо стандартного, от ловкости", "owner"),
  DMG_AMP: skill("носитель получает больше урона на долю (0.23 = +23%)", "spell-text"),
  pcDMG_AMP: skill("то же в процентах", "spell-text"),
  VAMP: skill("лечение носителя на долю ИТОГОВОГО урона его удара; минус = самоурон", "owner"),
  pcVAMP: skill("неизвестно (единичный спелл «Поцелуй бездны»)", "unknown"),
  ANTIVAMP: skill(
    "самоурон носителя на долю итогового урона его удара, ОТДЕЛЬНЫМ пакетом",
    "owner",
  ),
  ANTI_STUN: skill("иммунитет к стану на срок эффекта (100 = 100%)", "spell-text"),
  RAGE_MOD: skill(
    "прибавка к накоплению ярости, процент; действует на следующее получение урона",
    "owner",
  ),
  pcRAGE_MOD: skill("то же, процентное изменение", "owner"),
  MAGSTR_ACD: skill("сила магии кислоты, плоская прибавка", "owner"),
  MAGSTR_DRK: skill("сила магии тьмы, плоская прибавка", "owner"),
  MAGSTR_FR: skill("сила магии огня, плоская прибавка (2000 в данных = «+25» в тексте)", "owner"),
  MAGSTR_ICE: skill("сила магии льда, плоская прибавка", "owner"),
  MAGSTR_LGH: skill("сила магии молнии, плоская прибавка", "owner"),
  MAGSTR_LTN: skill("сила магии света, плоская прибавка", "owner"),
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
