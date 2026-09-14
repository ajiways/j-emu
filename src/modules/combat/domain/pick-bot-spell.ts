import type { HuntBotSpellBook, HuntBotSpellCard } from "./hunt-bot-spell-book.ts";
import type { RandomSource } from "./random-source.ts";

export function pickBotSpell(
  book: HuntBotSpellBook,
  input: Readonly<{
    botHp: number;
    botMaxHp: number;
    casts: Map<number, number>;
  }>,
  random: RandomSource,
): HuntBotSpellCard | null {
  if (book.spells.length === 0) return null;

  for (const card of book.spells) {
    if (card.slot !== "fight_start") continue;
    const maxCasts = card.maxCasts ?? 1;
    if (castCount(input.casts, card.artikulId) >= maxCasts) continue;
    if (canCast(card, input)) return card;
    noteCast(input.casts, card.artikulId);
  }

  for (const card of book.spells) {
    if (card.slot !== "prefer") continue;
    if (canCast(card, input)) return card;
  }

  const ready = book.spells.filter(
    (card) => card.slot === "turn_roulette" && card.weight > 0 && canCast(card, input),
  );
  if (ready.length === 0) return null;
  return rollWeighted(ready, book.nothingWeight, random);
}

export function noteCast(casts: Map<number, number>, artikulId: number): void {
  casts.set(artikulId, castCount(casts, artikulId) + 1);
}

function castCount(casts: Map<number, number>, artikulId: number): number {
  return casts.get(artikulId) ?? 0;
}

function canCast(
  card: HuntBotSpellCard,
  input: Readonly<{ botHp: number; botMaxHp: number; casts: Map<number, number> }>,
): boolean {
  if (card.slot === "never") return false;
  if (card.gate === "foe_has_dispel_groups") return false;
  if (!card.spell.effects.some((effect) => effect.kind === 1 || effect.kind === 2)) {
    return false;
  }
  if (card.gate === "once" && castCount(input.casts, card.artikulId) >= (card.maxCasts ?? 1)) {
    return false;
  }
  if (card.maxCasts !== null && castCount(input.casts, card.artikulId) >= card.maxCasts) {
    return false;
  }
  if (card.gate === "self_hp_le") {
    if (card.hpPct === null) throw new Error(`Bot spell ${card.artikulId} hpPct is required`);
    if ((input.botHp * 100) / input.botMaxHp > card.hpPct) return false;
  }
  return true;
}

function rollWeighted(
  cards: readonly HuntBotSpellCard[],
  nothingWeight: number,
  random: RandomSource,
): HuntBotSpellCard | null {
  let pool = 0;
  for (const card of cards) pool += card.weight;
  const nothing = Math.max(0, nothingWeight);
  const total = pool + nothing;
  if (total <= 0) return null;
  let rest = random.unit() * total;
  if (rest < nothing) return null;
  rest -= nothing;
  for (const card of cards) {
    rest -= card.weight;
    if (rest < 0) return card;
  }
  const last = cards[cards.length - 1];
  if (!last) throw new Error("Weighted bot spell pool is empty");
  return last;
}
