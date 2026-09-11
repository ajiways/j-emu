import {
  honorProgress,
  honorRankCatalogFromConf,
} from "../modules/catalog/domain/honor-progress.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { Hero } from "../modules/character/domain/hero.ts";
import type { CharacterProgression } from "../modules/character/ports/character-progression.ts";
import type { PvpFightOutcomeSnapshot } from "../modules/combat/domain/fight-outcome-snapshot.ts";
import { rawHonorFromDamage, type HeroismRules } from "./heroism-rules.ts";
import type { PvpHonorShare } from "./pvp-fight-honor-cache.ts";

type HonorCharacters = CharacterProgression &
  Readonly<{
    lockById(characterId: number): Promise<Hero>;
  }>;

export async function persistPvpHonor(input: {
  outcome: PvpFightOutcomeSnapshot;
  characters: HonorCharacters;
  catalog: Pick<Catalog, "commonConf">;
  rules: HeroismRules;
}): Promise<readonly PvpHonorShare[]> {
  if (input.outcome.humans.length !== 2) {
    throw new Error(`PvP snapshot ${input.outcome.fightId} must have exactly 2 humans`);
  }
  const ranks = honorRankCatalogFromConf(await input.catalog.commonConf());
  const shares: PvpHonorShare[] = [];
  for (const human of input.outcome.humans) {
    const victim = input.outcome.humans.find((row) => row.characterId !== human.characterId);
    if (!victim) {
      throw new Error(`PvP snapshot ${input.outcome.fightId} is missing the opposing human`);
    }
    const raw = rawHonorFromDamage(
      {
        dmgToVictim: human.damageToHumans,
        victimLevel: victim.level,
        victimHpMax: victim.maxHp,
        won: human.team === input.outcome.winnerTeam,
      },
      input.rules,
    );
    let rank: string;
    if (raw > 0) {
      const granted = await input.characters.grantHonor({
        characterId: human.characterId,
        operationId: `pvp:${input.outcome.fightId}:${human.characterId}`,
        amount: raw,
      });
      rank = String(granted.rank);
    } else {
      const hero = await input.characters.lockById(human.characterId);
      rank = String(honorProgress(ranks, hero.honor, hero.level).rank);
    }
    shares.push({
      characterId: human.characterId,
      accountId: human.accountId,
      honor: raw,
      dmg: human.damageToHumans,
      rank,
    });
  }
  return shares;
}
