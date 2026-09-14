import type { ContentBundle } from "../domain/content-document.ts";

export function collectBotSpellIssues(bundle: ContentBundle): readonly string[] {
  const issues: string[] = [];
  const byId = new Map(bundle.bots.map((bot) => [bot.id, bot]));
  const gryzl = byId.get(2);
  if (!gryzl) issues.push("bot 2 is required for CMB-06 melee-only regression");
  else if (gryzl.spellBook.spells.length > 0) {
    issues.push("bot 2 spellBook must be empty");
  }
  const hissa = byId.get(4);
  if (!hissa) issues.push("bot 4 is required for CMB-06 spellbook");
  else requireSpell(issues, hissa.id, hissa.spellBook, 396, "magic_direct", -50);
  const spirit = byId.get(32);
  if (!spirit) issues.push("bot 32 is required for CMB-06 spellbook");
  else requireSpell(issues, spirit.id, spirit.spellBook, 422, "magic_darkball", null);
  const red = byId.get(24);
  if (!red) issues.push("bot 24 is required for CMB-06 spellbook");
  else requireSpell(issues, red.id, red.spellBook, 394, "magic_direct", null);
  return issues;
}

function requireSpell(
  issues: string[],
  botId: number,
  book: ContentBundle["bots"][number]["spellBook"],
  artikulId: number,
  animData: string,
  pcStr: number | null,
): void {
  const card = book.spells.find((spell) => spell.artikulId === artikulId);
  if (!card) {
    issues.push(`bot ${botId} is missing dump-proven spell ${artikulId}`);
    return;
  }
  if (card.slot !== "turn_roulette") {
    issues.push(`bot ${botId} spell ${artikulId} slot must be turn_roulette`);
  }
  if (card.spell.animData !== animData) {
    issues.push(`bot ${botId} spell ${artikulId} animData must be ${animData}`);
  }
  if (card.spell.endTurn !== true) {
    issues.push(`bot ${botId} spell ${artikulId} must end the turn`);
  }
  const kind1 = card.spell.effects.find((effect) => effect.kind === 1);
  if (!kind1) {
    issues.push(`bot ${botId} spell ${artikulId} must include kind 1`);
    return;
  }
  if (pcStr === null) return;
  const skill = kind1.skills?.find((entry) => entry.skill_id === "pcSTR");
  if (!skill || skill.value !== pcStr) {
    issues.push(`bot ${botId} spell ${artikulId} pcSTR must be ${pcStr}`);
  }
}
