import { ProgressionContentError } from "./progression-content-error.ts";

export function requiredManagedL1(
  skills: readonly { id: string; value: number }[],
  id: string,
): number {
  const skill = skills.find((entry) => entry.id === id);
  if (!skill) throw new ProgressionContentError(`Progression L1 is missing ${id}`);
  if (skill.value < 1) throw new ProgressionContentError(`Progression L1 ${id} must be positive`);
  return skill.value;
}
