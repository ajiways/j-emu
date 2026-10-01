import { aggroOffer } from "./aggro-offer.ts";
import { BotFighter } from "./bot-fighter.ts";
import type { BattleEvent } from "./battle-event.ts";
import { unpublishedBotFightStats } from "./combatant-fight-stats.ts";
import type { CombatIdolRow, PhantomTemplate } from "./combat-loadout.ts";
import { FightCastDenied } from "./fight-cast-denied.ts";
import type { FightRules } from "./fight-rules.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { KeepTurnResult } from "./player-casts.ts";
import type { Roster } from "./roster.ts";
import { manaRange, payMana, requireMana } from "./spell-mana.ts";

const NO_SPELLS = { nothingWeight: 100, spells: [] } as const;

/** A phantom takes the stats its idol gives for the mana spent, in proportion to the full price. */
function phantomStats(
  template: PhantomTemplate,
  spent: number,
  full: number,
): Readonly<{ strength: number; maxHp: number }> {
  // A free idol (nothing to spend) always calls its phantom at full strength.
  const ratio = full === 0 ? 1 : Math.min(1, spent / full);
  return {
    strength: Math.max(1, Math.round(template.strength * ratio)),
    maxHp: Math.max(1, Math.round(template.maxHp * ratio)),
  };
}

/**
 * Casts an idol: spends the mana and calls the phantom to the caster's side, where it waits for
 * a foe like any mob. The bag item is consumed by the caller through `consumeBagItemId`.
 */
export function tryIdolCast(
  input: Readonly<{
    human: HumanFighter;
    itemId: number;
    sequence: string | number;
    roster: Roster;
    fightRules: FightRules;
    finished: boolean;
    allocateBotId: () => number;
  }>,
): KeepTurnResult {
  const { human } = input;
  if (!human.authed || human.waiting || human.hp === 0 || input.finished) {
    return { kind: "ignored" };
  }
  const row = human.casts.idolRow(input.itemId);
  if (!row) return { kind: "ignored" };
  if (!row.phantom) {
    throw new Error(
      `Idol ${row.artifactId} summons mob ${summonedBot(row)}, absent from the catalog`,
    );
  }
  const group = row.spell.groupId ?? null;
  if (group !== null && input.roster.bots.some((bot) => bot.summonedGroupId === group)) {
    throw new FightCastDenied("phantom", input.sequence);
  }
  requireMana(human, row.spell, input.sequence);
  const range = manaRange(row.spell);
  const spent = Math.min(human.mp, range.max);
  const stats = phantomStats(row.phantom, spent, range.max);
  human.casts.consumeIdol(input.itemId);
  const mana = payMana(human, row.spell);
  const phantom = summon(human, row.phantom, stats, input);
  phantom.summoned = true;
  phantom.summonedGroupId = group;
  input.roster.add(phantom);
  phantom.unpair();
  const events: BattleEvent[] = [
    ...(mana ? [mana] : []),
    {
      type: "native-count",
      srcId: 7,
      count: aggroOffer(human, input.fightRules),
      title: "Разозлить",
      loadout: human.casts.wireLoadout(),
    },
    {
      type: "roster-updated",
      humans: input.roster.humans.map((entry) => entry.snapshot()),
      bot: phantom.snap(),
      joined: human.snapshot(),
      rosterBots: input.roster.bots.map((bot) => bot.snap()),
    },
  ];
  return { kind: "resolved", events, consumeBagItemId: input.itemId };
}

function summonedBot(row: CombatIdolRow): number | undefined {
  return row.spell.effects.find((effect) => effect.kind === 10)?.botArtikulId;
}

function summon(
  human: HumanFighter,
  template: PhantomTemplate,
  stats: Readonly<{ strength: number; maxHp: number }>,
  input: Readonly<{ allocateBotId: () => number }>,
): BotFighter {
  const fight = unpublishedBotFightStats(stats.strength);
  return BotFighter.fromSeed(
    {
      fightId: input.allocateBotId(),
      artikulId: template.artikulId,
      nick: template.nick,
      level: template.level,
      hp: stats.maxHp,
      strength: stats.strength,
      initiative: fight.initiative,
      magPower: fight.mag.power,
      magResist: fight.mag.resist,
      avatar: template.avatar,
      sk: template.sk,
      body: template.body,
      spellBook: NO_SPELLS,
    },
    human.team,
    human.effects.effectIds,
  );
}
