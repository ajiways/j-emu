import {
  honorProgress,
  honorRankCatalogFromConf,
} from "../modules/catalog/domain/honor-progress.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { Hero } from "../modules/character/domain/hero.ts";
import type { CharacterProgression } from "../modules/character/ports/character-progression.ts";
import type { PvpFightOutcomeSnapshot } from "../modules/combat/domain/fight-outcome-snapshot.ts";
import { rawHonorFromVictims, type HeroismRules } from "./heroism-rules.ts";
import type { FightProgressUp } from "./fight-progress-log.ts";
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
}): Promise<Readonly<{ shares: readonly PvpHonorShare[]; rankUps: readonly FightProgressUp[] }>> {
  const ranks = honorRankCatalogFromConf(await input.catalog.commonConf());
  const shares: PvpHonorShare[] = [];
  const rankUps: FightProgressUp[] = [];
  for (const human of input.outcome.humans) {
    // Only the damage dealt to human enemies counts: mobs and phantoms are not in the ledger.
    const victims = human.damageByVictim.map((dealt) => {
      const victim = input.outcome.humans.find((row) => row.characterId === dealt.victimId);
      if (!victim) {
        throw new Error(`PvP snapshot ${input.outcome.fightId} has no victim ${dealt.victimId}`);
      }
      return { dmgToVictim: dealt.damage, victimLevel: victim.level, victimHpMax: victim.maxHp };
    });
    const raw = rawHonorFromVictims(victims, human.team === input.outcome.winnerTeam, input.rules);
    let rank: string;
    if (raw > 0) {
      const granted = await input.characters.grantHonor({
        characterId: human.characterId,
        operationId: `pvp:${input.outcome.fightId}:${human.characterId}`,
        amount: raw,
      });
      rank = String(granted.rank);
      const before = honorProgress(ranks, granted.honorBefore, human.level).rank;
      if (granted.rank > before) {
        rankUps.push({
          kind: "rank",
          accountId: human.accountId,
          before,
          after: granted.rank,
          heroLevel: human.level,
        });
      }
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
  return { shares, rankUps };
}
