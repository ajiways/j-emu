import { describe, expect, it } from "vitest";
import {
  collectWornSets,
  isMaleHeroGender,
  isSetPieceSlot,
  KIND_SET,
  parseSetId,
  pickSetBonusArtikul,
  pickSetPortrait,
  SET_AVATAR_MIN,
  SET_BONUS_EXPIRE,
  SET_MIX_ERROR,
  setAvatarSmallName,
  setMixBlocked,
  skipSetCountKind,
  SLOT_TEMPEFFECT,
  wantedSetBonusArtikuls,
  type ArtifactSetInfo,
} from "../../../src/modules/inventory/domain/gear-sets.ts";

const recruit: ArtifactSetInfo = {
  setId: 47,
  title: "Рекрута",
  thresholds: [
    { count: 5, artikulId: 106 },
    { count: 9, artikulId: 107 },
  ],
  avatarMan: "avatar_m_set_1_gray.png",
  avatarWoman: "avatar_f_set_1_gray.png",
};

describe("gear set formulas", () => {
  it("picks the highest bonusN at or below worn count", () => {
    expect(pickSetBonusArtikul(recruit.thresholds, 4)).toBe(0);
    expect(pickSetBonusArtikul(recruit.thresholds, 5)).toBe(106);
    expect(pickSetBonusArtikul(recruit.thresholds, 9)).toBe(107);
  });

  it("overlays the 2D portrait at four pieces and prefers the larger count", () => {
    expect(SET_AVATAR_MIN).toBe(4);
    expect(setAvatarSmallName(recruit.avatarMan)).toBe("avatar_m_set_1_gray_sm.png");
    expect(
      pickSetPortrait(
        [
          { setId: 47, count: 4, info: recruit },
          {
            setId: 48,
            count: 5,
            info: {
              ...recruit,
              setId: 48,
              title: "Убийцы",
              avatarMan: "avatar_m_set_2.png",
              avatarWoman: "",
            },
          },
        ],
        true,
      ),
    ).toEqual({ big: "avatar_m_set_2.png", small: "avatar_m_set_2_sm.png" });
  });

  it("blocks two class trends and allows trend 0 with either class", () => {
    expect(setMixBlocked([0, 1])).toBe(false);
    expect(setMixBlocked([1, 3])).toBe(true);
    expect(SET_MIX_ERROR).toBe("Эту вещь нельзя надеть!");
  });

  it("asks for kind-139 bonus rows from worn counts and skips counting the bonus itself", () => {
    expect(skipSetCountKind(KIND_SET)).toBe(true);
    expect(wantedSetBonusArtikuls([{ setId: 47, count: 5, info: recruit }])).toEqual([106]);
  });

  it("counts only paperdoll bits and treats gender 2 as female portrait", () => {
    expect(parseSetId(recruit)).toBe(47);
    expect(isMaleHeroGender(1)).toBe(true);
    expect(isMaleHeroGender(2)).toBe(false);
    expect(isSetPieceSlot(2, 2)).toBe(true);
    expect(isSetPieceSlot(SLOT_TEMPEFFECT, SLOT_TEMPEFFECT)).toBe(false);
    expect(SET_BONUS_EXPIRE).toBe(0);
    expect(
      wantedSetBonusArtikuls(
        collectWornSets([
          { slot: 2, slotMask: 2, kindId: 20, set: recruit },
          { slot: 4, slotMask: 4, kindId: 6, set: recruit },
          { slot: 32, slotMask: 32, kindId: 44, set: recruit },
          { slot: 64, slotMask: 64, kindId: 98, set: recruit },
          { slot: 256, slotMask: 256, kindId: 47, set: recruit },
          { slot: SLOT_TEMPEFFECT, slotMask: 0, kindId: KIND_SET, set: null },
        ]),
      ),
    ).toEqual([106]);
  });
});
