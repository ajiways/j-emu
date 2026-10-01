import { requireFightSafeItemId, requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";

type CombatSpellEffect = Readonly<{
  kind: number;
  order?: number;
  hidden?: number;
  dmgMask?: number;
  amount?: number | string;
  dmgType?: number;
  charging?: number;
  capacity?: number;
  targetCount?: number;
  targetEffectGroupId?: number;
  duration?: number;
  durationInTurns?: boolean;
  period?: number;
  forceSelfTargeting?: boolean;
  realStartTime?: boolean;
  /** Kind 10: the mob artikul this effect summons. */
  botArtikulId?: number;
  /** Kind 10 with a spend range: mana above `mpCost` that strengthens the summon. */
  manaCost?: number;
  skills?: readonly Readonly<{ skillId: string; value: number }>[];
}>;

export type CombatSpell = Readonly<{
  animData?: string;
  groupId?: number;
  cooldown?: number;
  /** Mana the cast takes; a spell with a spend range takes up to this plus its `manaCost`. */
  mpCost?: number;
  endTurn?: boolean;
  flags?: string;
  persRestr?: Readonly<Record<string, unknown>>;
  targetRestr?: Readonly<Record<string, unknown>>;
  triggers?: unknown;
  onlyPvP?: unknown;
  effects: readonly CombatSpellEffect[];
}>;

export type CombatPocketRow = Readonly<{
  itemId: number;
  artifactId: number;
  position: number;
  count: number;
  title: string;
  picture: string;
  spell: CombatSpell;
}>;

export type CombatGloveSpell = Readonly<{
  artikulId: number;
  cost: number;
  row: number;
  title: string;
  picture: string;
  spell: CombatSpell;
}>;

export type CombatGloveLoadout = Readonly<{
  hits: readonly number[];
  spells: readonly CombatGloveSpell[];
}>;

export type CombatGearSpell = Readonly<{
  artikulId: number;
  title: string;
  picture: string;
  spell: CombatSpell;
}>;

/** The mob an idol calls, at the stats it has for the full mana of its spell. */
export type PhantomTemplate = Readonly<{
  artikulId: number;
  nick: string;
  level: number;
  strength: number;
  /** The first-strike weight the mob is called with (the mob's `LUCK`). */
  initiative: number;
  maxHp: number;
  avatar: string;
  sk: string;
  body: string;
}>;

/** An idol in the bag: a summon spell the hero can cast in the fight, once per item. */
export type CombatIdolRow = Readonly<{
  itemId: number;
  artifactId: number;
  count: number;
  title: string;
  picture: string;
  spell: CombatSpell;
  /** `null` while the catalog has no mob for the idol; casting it then fails. */
  phantom: PhantomTemplate | null;
}>;

export type CombatLoadout = Readonly<{
  pocket: readonly CombatPocketRow[];
  idols: readonly CombatIdolRow[];
  /** The native «Удар в спину» spell (artikul 487) of a player; `null` for one who has none. */
  concentration: CombatSpell | null;
  glove: CombatGloveLoadout | null;
  gearSpells: readonly CombatGearSpell[];
  /** The party the hero fights in, for spells that only reach party members; `null` for none. */
  partyId: number | null;
}>;

export const EMPTY_COMBAT_LOADOUT: CombatLoadout = {
  pocket: [],
  idols: [],
  concentration: null,
  glove: null,
  gearSpells: [],
  partyId: null,
};

export function requireCombatLoadout(loadout: CombatLoadout): void {
  const seen = new Set<number>();
  for (const row of loadout.pocket) {
    requireFightSafeItemId(BigInt(row.itemId));
    requireWireIdentity(row.artifactId, "pocket artifact id");
    if (!Number.isInteger(row.position) || row.position < 1) {
      throw new Error(`Pocket item ${row.itemId} position must be positive`);
    }
    if (!Number.isInteger(row.count) || row.count < 1) {
      throw new Error(`Pocket item ${row.itemId} count must be positive`);
    }
    if (seen.has(row.itemId)) throw new Error(`Duplicate pocket item ${row.itemId}`);
    seen.add(row.itemId);
    if (row.spell.effects.length < 1) {
      throw new Error(`Pocket item ${row.itemId} spell effects are required`);
    }
  }
  requireIdols(loadout, seen);
  requireGearSpells(loadout);
  if (!loadout.glove) return;
  if (loadout.glove.hits.length !== 8) throw new Error("Glove hits must contain 8 L/C/R steps");
  for (const hit of loadout.glove.hits) {
    if (hit !== 1 && hit !== 2 && hit !== 3) throw new Error("Glove hit must be 1, 2 or 3");
  }
  for (const spell of loadout.glove.spells) {
    requireWireIdentity(spell.artikulId, "glove spell id");
    if (!Number.isInteger(spell.cost) || spell.cost < 1) {
      throw new Error(`Glove spell ${spell.artikulId} cost must be positive`);
    }
    if (spell.spell.effects.length < 1) {
      throw new Error(`Glove spell ${spell.artikulId} effects are required`);
    }
  }
}

function requireIdols(loadout: CombatLoadout, seen: Set<number>): void {
  for (const idol of loadout.idols) {
    requireFightSafeItemId(BigInt(idol.itemId));
    requireWireIdentity(idol.artifactId, "idol artifact id");
    if (!Number.isInteger(idol.count) || idol.count < 1) {
      throw new Error(`Idol item ${idol.itemId} count must be positive`);
    }
    if (seen.has(idol.itemId)) throw new Error(`Duplicate fight item ${idol.itemId}`);
    seen.add(idol.itemId);
    if (!idol.spell.effects.some((effect) => effect.kind === 10)) {
      throw new Error(`Idol item ${idol.itemId} has no summon effect`);
    }
  }
}

function requireGearSpells(loadout: CombatLoadout): void {
  for (const gear of loadout.gearSpells) {
    requireWireIdentity(gear.artikulId, "gear spell artikul id");
    if (!gear.title) throw new Error(`Gear spell ${gear.artikulId} title is required`);
    if (!gear.picture) throw new Error(`Gear spell ${gear.artikulId} picture is required`);
    if (gear.spell.triggers !== undefined) {
      throw new Error(`Gear spell ${gear.artikulId} must not have triggers`);
    }
    if (gear.spell.onlyPvP !== undefined) {
      throw new Error(`Gear spell ${gear.artikulId} must not have onlyPvP`);
    }
    if (gear.spell.effects.length < 1) {
      throw new Error(`Gear spell ${gear.artikulId} effects are required`);
    }
    for (const effect of gear.spell.effects) {
      if (effect.kind !== 3) {
        throw new Error(`Gear spell ${gear.artikulId} kind must be 3`);
      }
      if (effect.duration === undefined) {
        throw new Error(`Gear spell ${gear.artikulId} duration is required`);
      }
    }
  }
}
