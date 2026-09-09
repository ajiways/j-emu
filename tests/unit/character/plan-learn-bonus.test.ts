import { describe, expect, it } from "vitest";
import { ArtifactBonus } from "../../../src/modules/catalog/domain/artifact-bonus.ts";
import { LearnBonusDeniedError } from "../../../src/modules/character/domain/learn-bonus-denied-error.ts";
import {
  LEARN_TOO_GREEN,
  LEARN_TOO_WISE,
  planLearnBonus,
} from "../../../src/modules/character/domain/plan-learn-bonus.ts";

const bonus = new ArtifactBonus(
  601,
  "skill",
  "AGRILKA_MOBOV",
  1,
  0,
  623,
  "Пособие «Слабая злость»",
  "chat",
);

describe("planLearnBonus", () => {
  it("teaches 0→1", () => {
    expect(planLearnBonus({ bonus, currentValue: 0, alreadyLearned: false })).toEqual({
      nextValue: 1,
    });
  });

  it("denies a second copy of the same book", () => {
    expect(() => planLearnBonus({ bonus, currentValue: 0, alreadyLearned: true })).toThrow(
      LearnBonusDeniedError,
    );
    expect(() => planLearnBonus({ bonus, currentValue: 0, alreadyLearned: true })).toThrow(
      LEARN_TOO_WISE,
    );
  });

  it("denies when the current skill is already above needValue", () => {
    expect(() => planLearnBonus({ bonus, currentValue: 1, alreadyLearned: false })).toThrow(
      LEARN_TOO_WISE,
    );
  });

  it("denies when the current skill is below needValue", () => {
    const later = new ArtifactBonus(602, "skill", "AGRILKA_MOBOV", 1, 1, 624, "next", "");
    expect(() => planLearnBonus({ bonus: later, currentValue: 0, alreadyLearned: false })).toThrow(
      LEARN_TOO_GREEN,
    );
  });
});
