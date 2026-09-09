import type { ArtifactBonus } from "../../catalog/domain/artifact-bonus.ts";
import { LearnBonusDeniedError } from "./learn-bonus-denied-error.ts";

export const LEARN_TOO_GREEN = "Вы недостаточно опытны, чтобы понять, что тут написано.";
export const LEARN_TOO_WISE = "Вы уже слишком опытны, и этот материал не несёт для вас ценности.";

export function planLearnBonus(input: {
  bonus: ArtifactBonus;
  currentValue: number;
  alreadyLearned: boolean;
}): Readonly<{ nextValue: number }> {
  if (input.alreadyLearned) throw new LearnBonusDeniedError(LEARN_TOO_WISE);
  if (!Number.isInteger(input.currentValue) || input.currentValue < 0) {
    throw new Error(`Bonus ${input.bonus.id} current skill value is invalid`);
  }
  if (input.currentValue < input.bonus.needValue) {
    throw new LearnBonusDeniedError(LEARN_TOO_GREEN);
  }
  if (input.currentValue > input.bonus.needValue) {
    throw new LearnBonusDeniedError(LEARN_TOO_WISE);
  }
  const nextValue = input.currentValue + input.bonus.delta;
  if (!Number.isInteger(nextValue) || nextValue < 0) {
    throw new Error(`Bonus ${input.bonus.id} next skill value is invalid`);
  }
  return { nextValue };
}
