import { Battle } from "../domain/battle.ts";
import type { BattleRules } from "../domain/battle-rules.ts";
import type { EphemeralBotFightIds } from "../domain/ephemeral-bot-fight-ids.ts";
import type { HuntRosterBotSeed } from "../domain/hunt-roster-bot.ts";
import type { RandomSource } from "../domain/random-source.ts";
import type { HuntStartInput } from "../ports/combat-port.ts";
import { huntBattleInitFromStart } from "./hunt-battle-init-from-start.ts";

export function createHuntBattle(
  input: HuntStartInput,
  accessKey: string,
  botFightIds: EphemeralBotFightIds,
  startedAt: Date,
  testBotStrength: number | undefined,
  rules: BattleRules,
  random: RandomSource,
): Battle {
  if (input.purpose === "hunt" && (input.extraEnemies.length > 0 || input.allies.length > 0)) {
    throw new Error("Hunt fights cannot include a quest roster");
  }
  const primaryStrength = appliedStrength(input.botStrength, testBotStrength);
  const primaryFightId = botFightIds.allocate(input.heroId);
  const extraEnemies = seedRoster(input.extraEnemies, input.heroId, botFightIds, testBotStrength);
  const allies = seedRoster(input.allies, input.heroId, botFightIds, testBotStrength);
  return new Battle(
    huntBattleInitFromStart(
      { ...input, botStrength: primaryStrength },
      accessKey,
      primaryFightId,
      startedAt,
      extraEnemies,
      allies,
    ),
    rules,
    random,
  );
}

function seedRoster(
  bots: HuntStartInput["extraEnemies"],
  heroId: number,
  botFightIds: EphemeralBotFightIds,
  testBotStrength: number | undefined,
): readonly HuntRosterBotSeed[] {
  return bots.map((bot) => ({
    fightId: botFightIds.allocate(heroId),
    artikulId: bot.artikulId,
    nick: bot.nick,
    level: bot.level,
    hp: bot.hp,
    strength: appliedStrength(bot.strength, testBotStrength),
    avatar: bot.avatar,
    sk: bot.sk,
    body: bot.body,
    spellBook: bot.spellBook,
  }));
}

function appliedStrength(strength: number, testBotStrength: number | undefined): number {
  const value = testBotStrength === undefined ? strength : testBotStrength;
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("Hunt bot strength must be positive");
  }
  return value;
}
