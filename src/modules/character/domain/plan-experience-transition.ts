import type { ProgressionSnapshot } from "../../catalog/domain/progression-snapshot.ts";
import { PROGRESSION_MANAGED_SKILL_IDS } from "../../content/domain/progression-managed-skills.ts";
import { CharacterProgressionStateError } from "./character-progression-state-error.ts";
import type { HeroSkill } from "./hero-skill.ts";
import { ProgressionLimitError } from "./progression-limit-error.ts";
import { requireExperienceSum } from "./parse-experience-grant-command.ts";

export type ExperienceTransition = Readonly<{
  expAfter: number;
  levelAfter: number;
  nextManaged: readonly HeroSkill[];
  miscSkills: readonly HeroSkill[];
}>;

export function planExperienceTransition(input: {
  exp: number;
  level: number;
  skills: readonly HeroSkill[];
  snapshot: ProgressionSnapshot;
  amount: number;
}): ExperienceTransition {
  const current = input.snapshot.levels.find((entry) => entry.boundary.level === input.level);
  if (!current) {
    throw new CharacterProgressionStateError(
      `Hero level ${input.level} is not on the published curve`,
    );
  }
  if (input.exp < current.boundary.expMin || input.exp >= current.boundary.expMax) {
    throw new CharacterProgressionStateError(
      `Hero EXP ${input.exp} is not inside stored level ${input.level}`,
    );
  }
  const { managed, misc } = splitSkills(input.skills);
  assertManagedMatch(input.level, managed, current.managedSkills);
  const expAfter = requireExperienceSum(input.exp, input.amount);
  const next = input.snapshot.boundaryForExp(expAfter);
  if (!next) throw new ProgressionLimitError(expAfter);
  return {
    expAfter,
    levelAfter: next.boundary.level,
    nextManaged: next.managedSkills.map((skill) => ({ id: skill.id, value: skill.value })),
    miscSkills: misc,
  };
}

function splitSkills(skills: readonly HeroSkill[]): {
  managed: readonly HeroSkill[];
  misc: readonly HeroSkill[];
} {
  const managed: HeroSkill[] = [];
  const misc: HeroSkill[] = [];
  for (const skill of skills) {
    if ((PROGRESSION_MANAGED_SKILL_IDS as readonly string[]).includes(skill.id)) {
      managed.push(skill);
    } else {
      misc.push(skill);
    }
  }
  return { managed, misc };
}

function assertManagedMatch(
  level: number,
  stored: readonly HeroSkill[],
  expected: readonly { id: string; value: number }[],
): void {
  const storedById = new Map(stored.map((skill) => [skill.id, skill.value]));
  for (const skill of expected) {
    const value = storedById.get(skill.id);
    if (value === undefined) {
      throw new CharacterProgressionStateError(
        `Hero is missing managed skill ${skill.id} for level ${level}`,
      );
    }
    if (value !== skill.value) {
      throw new CharacterProgressionStateError(
        `Hero skill ${skill.id} does not match published level ${level}`,
      );
    }
    storedById.delete(skill.id);
  }
  const extra = [...storedById.keys()][0];
  if (extra) {
    throw new CharacterProgressionStateError(
      `Hero has unexpected managed skill ${extra} for level ${level}`,
    );
  }
}
