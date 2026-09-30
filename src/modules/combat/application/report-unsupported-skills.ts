import type { BotFighter } from "../domain/bot-fighter.ts";
import type { CombatSpell } from "../domain/combat-loadout.ts";
import type { HumanFighter } from "../domain/human-fighter.ts";
import { unsupportedSkillsOf } from "../domain/unsupported-skills.ts";
import type { CombatDiagnostics, UnsupportedSkillReport } from "../ports/combat-diagnostics.ts";

type SpellSource = Readonly<{
  source: UnsupportedSkillReport["source"];
  participantId: number;
  artikulId: number;
  title: string;
  spell: CombatSpell;
}>;

/** Logs, once when a fighter enters a fight, every spell skill combat does not apply yet. */
export function reportUnsupportedSkills(
  diagnostics: CombatDiagnostics,
  fightId: string,
  fighters: Readonly<{ humans: readonly HumanFighter[]; bots: readonly BotFighter[] }>,
): void {
  for (const source of [
    ...fighters.humans.flatMap(humanSpells),
    ...fighters.bots.flatMap(botSpells),
  ]) {
    for (const { skillId, effectKind } of unsupportedSkillsOf(source.spell)) {
      diagnostics.unsupportedSkill({
        fightId,
        source: source.source,
        participantId: source.participantId,
        artikulId: source.artikulId,
        title: source.title,
        skillId,
        effectKind,
      });
    }
  }
}

function humanSpells(human: HumanFighter): readonly SpellSource[] {
  const loadout = human.casts.loadout;
  const participantId = human.heroId;
  return [
    ...loadout.pocket.map((row) => ({
      source: "pocket" as const,
      participantId,
      artikulId: row.artifactId,
      title: row.title,
      spell: row.spell,
    })),
    ...(loadout.glove?.spells ?? []).map((glove) => ({
      source: "glove" as const,
      participantId,
      artikulId: glove.artikulId,
      title: glove.title,
      spell: glove.spell,
    })),
    ...loadout.gearSpells.map((gear) => ({
      source: "gear" as const,
      participantId,
      artikulId: gear.artikulId,
      title: gear.title,
      spell: gear.spell,
    })),
  ];
}

function botSpells(bot: BotFighter): readonly SpellSource[] {
  return bot.spellBook.spells.map((card) => ({
    source: "bot" as const,
    participantId: bot.fightId,
    artikulId: card.artikulId,
    title: card.title,
    spell: card.spell,
  }));
}
