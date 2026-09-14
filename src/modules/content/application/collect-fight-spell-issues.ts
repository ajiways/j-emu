import type { ContentBundle } from "../domain/content-document.ts";

const GEAR_SPELL_ARTIKUL_ID = 20546;
const GEAR_SPELL_GROUP_ID = 936;
const GEAR_SPELL_DURATION = 320;
const GEAR_SPELL_PC_STR = 10;

export function collectFightSpellIssues(artifacts: ContentBundle["artifacts"]): readonly string[] {
  const issues: string[] = [];
  const byId = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const elixir = byId.get(93);
  if (!elixir?.extra.spell) {
    issues.push("artifact 93 is missing dump-proven extra.spell");
  } else {
    if (elixir.extra.spell.cooldown !== 20) {
      issues.push("artifact 93 spell cooldown must be 20");
    }
    if (!elixir.extra.spell.effects.some((effect) => effect.kind === 2)) {
      issues.push("artifact 93 spell must include a kind-2 heal effect");
    }
  }
  const orb = byId.get(99);
  if (!orb?.extra.spell) {
    issues.push("artifact 99 is missing dump-proven extra.spell");
  } else if (!orb.extra.spell.effects.some((effect) => effect.kind === 3)) {
    issues.push("artifact 99 spell must include a kind-3 charging effect");
  }
  const meat = byId.get(77);
  if (meat?.extra.spell) issues.push("artifact 77 must not carry a fight spell blob");
  const glove = byId.get(9095);
  const socketIds = glove?.extra.spells?.map((socket) => socket.artikul_id0) ?? [];
  if (!glove?.extra.spells) {
    issues.push("artifact 9095 is missing dump-proven extra.spells sockets");
  } else if (socketIds.join(",") !== "9098,9100,9099" && socketIds.join(",") !== "9098,9099,9100") {
    issues.push("artifact 9095 sockets must be artikul_id0 9098/9100/9099");
  }
  if (!glove?.extra.hits || glove.extra.hits.length !== 8) {
    issues.push("artifact 9095 is missing dump-proven extra.hits");
  }
  for (const spellId of [9098, 9100, 9099]) {
    const spell = byId.get(spellId);
    if (!spell?.extra.spell) {
      issues.push(`artifact ${spellId} is missing dump-proven extra.spell`);
    }
  }
  issues.push(...collectPaperdollGearSpellIssues(artifacts, byId));
  return issues;
}

function collectPaperdollGearSpellIssues(
  artifacts: ContentBundle["artifacts"],
  byId: ReadonlyMap<number, ContentBundle["artifacts"][number]>,
): readonly string[] {
  const issues: string[] = [];
  const tyrant = byId.get(GEAR_SPELL_ARTIKUL_ID);
  if (!tyrant) {
    issues.push(`artifact ${GEAR_SPELL_ARTIKUL_ID} is missing dump-proven extra.spell`);
    return issues;
  }
  if (tyrant.picture !== "dosp_tir_mif_mag.png") {
    issues.push(`artifact ${GEAR_SPELL_ARTIKUL_ID} picture must match Pub1 AMF`);
  }
  if (tyrant.levelMin !== 7) {
    issues.push(`artifact ${GEAR_SPELL_ARTIKUL_ID} levelMin must be 7`);
  }
  if (tyrant.kindId !== 44) {
    issues.push(`artifact ${GEAR_SPELL_ARTIKUL_ID} kindId must be 44`);
  }
  if (tyrant.typeId !== "2") {
    issues.push(`artifact ${GEAR_SPELL_ARTIKUL_ID} typeId must be 2`);
  }
  if (tyrant.slotMask !== 32) {
    issues.push(`artifact ${GEAR_SPELL_ARTIKUL_ID} slotMask must be 32`);
  }
  const spell = tyrant.extra.spell;
  if (!spell) {
    issues.push(`artifact ${GEAR_SPELL_ARTIKUL_ID} is missing dump-proven extra.spell`);
    return [...issues, ...paperdollSpellPolicyIssues(tyrant)];
  }
  if (spell.groupId !== GEAR_SPELL_GROUP_ID) {
    issues.push(
      `artifact ${GEAR_SPELL_ARTIKUL_ID} extra.spell groupId must be ${GEAR_SPELL_GROUP_ID}`,
    );
  }
  if (spell.triggers !== undefined) {
    issues.push(`artifact ${GEAR_SPELL_ARTIKUL_ID} extra.spell must not have triggers`);
  }
  if (spell.onlyPvP !== undefined) {
    issues.push(`artifact ${GEAR_SPELL_ARTIKUL_ID} extra.spell must not have onlyPvP`);
  }
  const kind3 = spell.effects.find((effect) => effect.kind === 3);
  if (!kind3) {
    issues.push(`artifact ${GEAR_SPELL_ARTIKUL_ID} extra.spell must include kind 3`);
  } else {
    if (kind3.duration !== GEAR_SPELL_DURATION) {
      issues.push(
        `artifact ${GEAR_SPELL_ARTIKUL_ID} extra.spell duration must be ${GEAR_SPELL_DURATION}`,
      );
    }
    if (kind3.forceSelfTargeting !== true) {
      issues.push(`artifact ${GEAR_SPELL_ARTIKUL_ID} extra.spell forceSelfTargeting must be true`);
    }
    if (kind3.realStartTime !== true) {
      issues.push(`artifact ${GEAR_SPELL_ARTIKUL_ID} extra.spell realStartTime must be true`);
    }
    const pcStr = kind3.skills?.find((skill) => skill.skill_id === "pcSTR");
    if (!pcStr || pcStr.value !== GEAR_SPELL_PC_STR) {
      issues.push(
        `artifact ${GEAR_SPELL_ARTIKUL_ID} extra.spell pcSTR must be ${GEAR_SPELL_PC_STR}`,
      );
    }
  }
  issues.push(...paperdollSpellPolicyIssues(tyrant));
  return issues;
}

function paperdollSpellPolicyIssues(
  artifact: ContentBundle["artifacts"][number],
): readonly string[] {
  const issues: string[] = [];
  const spell = artifact.extra.spell;
  if (!spell) return issues;
  if (spell.triggers !== undefined) {
    issues.push(`paperdoll artifact ${artifact.id} extra.spell must not have triggers`);
  }
  if (spell.onlyPvP !== undefined) {
    issues.push(`paperdoll artifact ${artifact.id} extra.spell must not have onlyPvP`);
  }
  for (const [index, effect] of spell.effects.entries()) {
    if (effect.kind !== 3) {
      issues.push(`paperdoll artifact ${artifact.id} extra.spell effect ${index} kind must be 3`);
    }
    if (effect.duration === undefined) {
      issues.push(
        `paperdoll artifact ${artifact.id} extra.spell effect ${index} duration is required`,
      );
    }
  }
  if (!artifact.picture) {
    issues.push(`paperdoll artifact ${artifact.id} picture is required for gear-spell img`);
  }
  return issues;
}
