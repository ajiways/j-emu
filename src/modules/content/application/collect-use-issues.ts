import type { ContentBundle } from "../domain/content-document.ts";

const SLOT_TEMPEFFECT = 134_217_728;

export function collectUseIssues(bundle: ContentBundle): readonly string[] {
  const issues: string[] = [];
  const byId = new Map(bundle.artifacts.map((artifact) => [artifact.id, artifact]));
  const bonusById = new Map(bundle.bonuses.map((bonus) => [bonus.id, bonus]));
  const scriptById = new Map(bundle.useScripts.map((script) => [script.bonusId, script]));
  if (!bundle.skills.some((skill) => skill.id === "AGRILKA_MOBOV")) {
    issues.push("missing required skill AGRILKA_MOBOV");
  }
  collectDuplicateIds(
    issues,
    "bonus",
    bundle.bonuses.map((bonus) => String(bonus.id)),
  );
  collectDuplicateIds(
    issues,
    "use_script",
    bundle.useScripts.map((script) => String(script.bonusId)),
  );

  const bread = byId.get(640);
  if (!bread) issues.push("USE representative 640 is missing");
  else {
    if (bread.title !== "Буханка изумительного хлеба") {
      issues.push("artifact 640 title must be Буханка изумительного хлеба");
    }
    if (bread.slotMask !== SLOT_TEMPEFFECT) issues.push("artifact 640 slotMask must be TEMPEFFECT");
    if (bread.extra.param1 !== 1800) issues.push("artifact 640 extra.param1 must be 1800");
    const drink = Object.values(bread.artifact_actions)[0];
    if (!drink || drink.code !== "DRINK") issues.push("artifact 640 use action must be DRINK");
    const vit = bread.skills.find((skill) => skill.id === "VIT");
    const str = bread.skills.find((skill) => skill.id === "STR");
    if (!vit || vit.value !== 4 || vit.flags !== 0) {
      issues.push("artifact 640 VIT must be +4 flags 0");
    }
    if (!str || str.value !== 6 || str.flags !== 0) {
      issues.push("artifact 640 STR must be +6 flags 0");
    }
  }

  const book = byId.get(623);
  if (!book) issues.push("USE representative 623 is missing");
  else {
    const action = Object.values(book.artifact_actions)[0];
    if (!action || action.code !== "") issues.push("artifact 623 use action code must be empty");
    if (action?.bonusId !== 601) issues.push("artifact 623 bonusId must be 601");
  }

  const part = byId.get(2371);
  if (!part) issues.push("USE representative 2371 is missing");
  else {
    const action = Object.values(part.artifact_actions)[0];
    if (!action || action.code !== "") issues.push("artifact 2371 use action code must be empty");
    if (action?.bonusId !== 2827) issues.push("artifact 2371 bonusId must be 2827");
    if (action?.dispose !== 0) issues.push("artifact 2371 dispose must be 0");
  }

  if (!byId.get(55)) issues.push("USE grant artifact 55 is missing");

  const head = byId.get(584);
  if (!head) issues.push("USE representative 584 is missing");
  else {
    const action = Object.values(head.artifact_actions)[0];
    if (!action || action.code !== "NPC") issues.push("artifact 584 use action must be NPC");
    if (action?.param1 !== 271) issues.push("artifact 584 NPC param1 must be 271");
  }

  const agrilka = bonusById.get(601);
  if (!agrilka) issues.push("bonus 601 is missing");
  else {
    if (agrilka.skillId !== "AGRILKA_MOBOV") issues.push("bonus 601 skillId must be AGRILKA_MOBOV");
    if (agrilka.artikulId !== 623) issues.push("bonus 601 artikulId must be 623");
    if (agrilka.needValue !== 0 || agrilka.delta !== 1) {
      issues.push("bonus 601 must be 0→1 AGRILKA_MOBOV");
    }
  }

  const amulet = scriptById.get(2827);
  if (!amulet) issues.push("use script 2827 is missing");
  else {
    if (amulet.effects.some((effect) => effect.type === "openDialog")) {
      issues.push("use script 2827 must not open a dialog");
    }
    const consume = amulet.effects.find((effect) => effect.type === "consume");
    const grant = amulet.effects.find((effect) => effect.type === "grant");
    if (consume?.type !== "consume" || consume.artikulId !== 2371 || consume.count !== 2) {
      issues.push("use script 2827 must consume two 2371");
    }
    if (grant?.type !== "grant" || grant.artikulId !== 55 || grant.count !== 1) {
      issues.push("use script 2827 must grant one 55");
    }
  }

  if (scriptById.has(900584) || scriptById.has(584)) {
    issues.push("584 uses artifact NPC action, not a use script");
  }

  for (const bonus of bundle.bonuses) {
    if (!byId.has(bonus.artikulId)) {
      issues.push(`bonus ${bonus.id} artikul ${bonus.artikulId} is missing`);
    }
    if (!bundle.skills.some((skill) => skill.id === bonus.skillId)) {
      issues.push(`bonus ${bonus.id} skill ${bonus.skillId} is missing`);
    }
  }
  for (const script of bundle.useScripts) {
    for (const row of script.require) {
      if (!byId.has(row.artikulId)) {
        issues.push(`use script ${script.bonusId} artikul ${row.artikulId} is missing`);
      }
    }
    for (const effect of script.effects) {
      if (effect.type === "openDialog") continue;
      if (!byId.has(effect.artikulId)) {
        issues.push(`use script ${script.bonusId} artikul ${effect.artikulId} is missing`);
      }
    }
  }
  return issues;
}

function collectDuplicateIds(issues: string[], type: string, keys: readonly string[]): void {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) issues.push(`duplicate ${type} id ${key}`);
    seen.add(key);
  }
}
