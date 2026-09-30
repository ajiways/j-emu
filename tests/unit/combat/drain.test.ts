import { describe, expect, it } from "vitest";
import { BotFighter } from "../../../src/modules/combat/domain/bot-fighter.ts";
import { settleDrain } from "../../../src/modules/combat/domain/drain.ts";
import { FightEffectIds } from "../../../src/modules/combat/domain/fight-effect-ids.ts";
import { EMPTY_HUNT_BOT_SPELL_BOOK } from "../../support/hunt-start-input.ts";

function swinger(hp: number): BotFighter {
  const bot = BotFighter.fromSeed(
    {
      fightId: 1_000_000,
      artikulId: 6,
      nick: "b",
      level: 1,
      hp: 100,
      strength: 10,
      initiative: 0,
      magPower: 0,
      magResist: 0,
      avatar: "a.jpg",
      sk: "1",
      body: "",
      spellBook: EMPTY_HUNT_BOT_SPELL_BOOK,
    },
    2,
    new FightEffectIds(),
  );
  bot.applyDamage(100 - hp);
  return bot;
}

describe("settleDrain", () => {
  it("heals the swinger by the share of the final damage, capped by what he is missing", () => {
    const bot = swinger(50);
    expect(settleDrain(bot, 20, { healPct: 30, hurtPct: 0 })).toMatchObject({
      healed: 6,
      hurtEvent: null,
      selfReact: 32,
    });
    expect(bot.hp).toBe(56);
    const nearFull = swinger(98);
    expect(settleDrain(nearFull, 20, { healPct: 30, hurtPct: 0 }).healed).toBe(2);
  });

  it("hurts the swinger with a separate hit and never kills him", () => {
    const bot = swinger(50);
    const outcome = settleDrain(bot, 20, { healPct: 0, hurtPct: 30 });
    expect(outcome.healed).toBe(0);
    expect(outcome.hurtEvent).toMatchObject({
      type: "damage",
      sourceId: 1_000_000,
      targetId: 1_000_000,
      animation: "",
      hpChange: -6,
    });
    expect(bot.hp).toBe(44);
    const low = swinger(3);
    settleDrain(low, 100, { healPct: 0, hurtPct: 90 });
    expect(low.hp).toBe(1);
  });

  it("lets heal and hurt both apply to one hit and does nothing for a hit that dealt nothing", () => {
    const bot = swinger(50);
    const both = settleDrain(bot, 10, { healPct: 50, hurtPct: 20 });
    expect(both.healed).toBe(5);
    expect(both.hurtEvent).toMatchObject({ hpChange: -2 });
    expect(settleDrain(bot, 0, { healPct: 50, hurtPct: 20 })).toMatchObject({
      healed: 0,
      hurtEvent: null,
    });
  });
});
