/** The lifetime fight counters of a hero. */
export type HeroLifetimeCounters = Readonly<{
  wins: number;
  losses: number;
  /** Friendly duels won. */
  duelWins: number;
  /** The most damage dealt in one fight. */
  maxFightDamage: number;
  /** Executions («Казни»). */
  fatalities: number;
  /** Players the hero finished off. */
  pvpKills: number;
  /** The same since the daily boundary. */
  dailyPvpKills: number;
}>;

/** What one finished fight adds to a hero's counters. */
export type FightCounterDelta = Readonly<{
  characterId: number;
  wins: number;
  losses: number;
  duelWins: number;
  /** Damage dealt in this fight; the counter keeps the largest. */
  fightDamage: number;
  fatalities: number;
  pvpKills: number;
  /** Unix time of the Moscow 06:00 that opened the day this fight ended in. */
  dailyCycleStart: number;
}>;

export interface HeroLifetimeStats {
  /** Adds the fight to the hero's counters; the daily kills start again in a later cycle. */
  applyFight(delta: FightCounterDelta): Promise<void>;
  /** The executions of the hero in all finished fights; zero for a hero with no row yet. */
  fatalityCount(characterId: number): Promise<number>;
  /** The counters; a hero who has not finished a fight yet has all of them at zero. */
  read(characterId: number, dailyCycleStart: number): Promise<HeroLifetimeCounters>;
}
