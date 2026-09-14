import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import type { ArtifactSpell } from "./artifact-spell.ts";

const CATALOG_BOT_SPELL_SLOTS = ["fight_start", "prefer", "turn_roulette", "never"] as const;

type CatalogBotSpellSlot = (typeof CATALOG_BOT_SPELL_SLOTS)[number];

export type BotSpellCard = Readonly<{
  artikulId: number;
  slot: CatalogBotSpellSlot;
  weight: number;
  maxCasts: number | null;
  gate: "self_hp_le" | "once" | "foe_has_dispel_groups" | null;
  hpPct: number | null;
  spell: ArtifactSpell;
}>;

export class BotSpellBook {
  constructor(
    readonly nothingWeight: number,
    readonly spells: readonly BotSpellCard[],
  ) {
    if (!Number.isInteger(nothingWeight) || nothingWeight < 0) {
      throw new Error("Bot spell book nothingWeight must be a non-negative integer");
    }
    const seen = new Set<number>();
    for (const card of spells) {
      requireWireIdentity(card.artikulId, "bot spell artikul id");
      if (seen.has(card.artikulId)) {
        throw new Error(`Duplicate bot spell artikul ${card.artikulId}`);
      }
      seen.add(card.artikulId);
      if (!CATALOG_BOT_SPELL_SLOTS.includes(card.slot)) {
        throw new Error(`Bot spell ${card.artikulId} slot is invalid`);
      }
      if (!Number.isInteger(card.weight) || card.weight < 0) {
        throw new Error(`Bot spell ${card.artikulId} weight is invalid`);
      }
      if (card.maxCasts !== null && (!Number.isInteger(card.maxCasts) || card.maxCasts < 1)) {
        throw new Error(`Bot spell ${card.artikulId} maxCasts is invalid`);
      }
      if (
        card.gate !== null &&
        card.gate !== "self_hp_le" &&
        card.gate !== "once" &&
        card.gate !== "foe_has_dispel_groups"
      ) {
        throw new Error(`Bot spell ${card.artikulId} gate is not supported`);
      }
      if ((card.gate === "self_hp_le") !== (card.hpPct !== null)) {
        throw new Error(`Bot spell ${card.artikulId} hpPct is required exactly when gated`);
      }
      if (
        card.hpPct !== null &&
        (!Number.isInteger(card.hpPct) || card.hpPct < 1 || card.hpPct > 100)
      ) {
        throw new Error(`Bot spell ${card.artikulId} hpPct is invalid`);
      }
      if (card.spell.effects.length < 1) {
        throw new Error(`Bot spell ${card.artikulId} effects are required`);
      }
    }
  }
}
