import { Battle } from "../domain/battle.ts";
import type { BattleRules } from "../domain/battle-rules.ts";
import type { EphemeralBotFightIds } from "../domain/ephemeral-bot-fight-ids.ts";
import { FightRules } from "../domain/fight-rules.ts";
import { resolveBotBody } from "../domain/bot-body-macros.ts";
import type { BotFighterSeed } from "../domain/bot-fighter.ts";
import type { RandomSource } from "../domain/random-source.ts";
import type { HuntStartInput } from "../ports/combat-port.ts";
import { fightSetupFromHuntStart } from "./fight-setup-from-hunt-start.ts";

export function createHuntBattle(
  input: HuntStartInput,
  accessKey: string,
  botFightIds: EphemeralBotFightIds,
  startedAt: Date,
  testBotStrength: number | undefined,
  rules: BattleRules,
  random: RandomSource,
  openingRandom: RandomSource,
): Battle {
  const fightRules = drilledRules(huntFightRules(input), input);
  if (!fightRules.allowsSideBots && (input.extraEnemies.length > 0 || input.allies.length > 0)) {
    throw new Error("Hunt fights cannot include a quest roster");
  }
  const primaryStrength = appliedStrength(input.botStrength, testBotStrength);
  const primaryBody = resolveBotBody(input.botBody, random);
  const primaryFightId = botFightIds.allocate(input.heroId);
  const extraEnemies = seedRoster(
    input.extraEnemies,
    input.heroId,
    botFightIds,
    testBotStrength,
    random,
  );
  const allies = seedRoster(input.allies, input.heroId, botFightIds, testBotStrength, random);
  return new Battle(
    fightSetupFromHuntStart(
      { ...input, botStrength: primaryStrength, botBody: primaryBody },
      accessKey,
      primaryFightId,
      startedAt,
      extraEnemies,
      allies,
      fightRules.teamAssignment,
    ),
    rules,
    fightRules,
    random,
    openingRandom,
  );
}

function drilledRules(rules: FightRules, input: HuntStartInput): FightRules {
  return input.drill === null ? rules : rules.drilled(input.drill);
}

function huntFightRules(input: HuntStartInput): FightRules {
  if (input.purpose === "quest") {
    return FightRules.for({
      kind: "quest",
      botCount: 1 + input.extraEnemies.length + input.allies.length,
    });
  }
  if (input.purpose === "hunt") {
    return FightRules.for({ kind: "hunt", instanceCopyId: input.instanceCopyId });
  }
  throw new Error(`Unknown hunt fight purpose: ${String(input.purpose)}`);
}

function seedRoster(
  bots: HuntStartInput["extraEnemies"],
  heroId: number,
  botFightIds: EphemeralBotFightIds,
  testBotStrength: number | undefined,
  random: RandomSource,
): readonly BotFighterSeed[] {
  return bots.map((bot) => ({
    fightId: botFightIds.allocate(heroId),
    artikulId: bot.artikulId,
    nick: bot.nick,
    level: bot.level,
    hp: bot.hp,
    strength: appliedStrength(bot.strength, testBotStrength),
    initiative: bot.initiative,
    magPower: bot.magPower,
    magResist: bot.magResist,
    avatar: bot.avatar,
    sk: bot.sk,
    body: resolveBotBody(bot.body, random),
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
