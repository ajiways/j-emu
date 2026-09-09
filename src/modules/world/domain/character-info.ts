type CharacterInfoSource = Readonly<{
  accountId: number;
  nick: string;
  level: number;
  kind: number;
  body: string;
  sk: number;
  ghost: boolean;
  injuryTime: number;
  injuryArtikulId: number;
}>;

export type CharacterInfo = Readonly<{
  id: number;
  nick: string;
  level: number;
  kind: number;
  instance_id: 0;
  dead: 0 | 4;
  injury_time: number;
  injury_artikul_id: number;
  body: string;
  sk: number;
  avatar_small: string;
}>;

export type AreaPopulationBlock = Readonly<{
  status: 100;
  population: readonly CharacterInfo[];
}>;

type PopulationDiffBlock = Readonly<{
  status: 100;
  add?: readonly CharacterInfo[];
  remove?: readonly string[];
}>;

export function buildCharacterInfo(hero: CharacterInfoSource, avatarSmall: string): CharacterInfo {
  if (!avatarSmall) {
    throw new Error(`Appearance avatar_small for account ${hero.accountId} is missing`);
  }
  return {
    id: hero.accountId,
    nick: hero.nick,
    level: hero.level,
    kind: hero.kind,
    instance_id: 0,
    dead: hero.ghost ? 4 : 0,
    injury_time: hero.ghost ? requireInjuryTime(hero) : 0,
    injury_artikul_id: hero.ghost ? requireInjuryArtikulId(hero) : 0,
    body: hero.body,
    sk: hero.sk,
    avatar_small: avatarSmall,
  };
}

function requireInjuryTime(hero: CharacterInfoSource): number {
  if (!Number.isInteger(hero.injuryTime) || hero.injuryTime < 1) {
    throw new Error(`Ghost account ${hero.accountId} is missing injury_time`);
  }
  return hero.injuryTime;
}

function requireInjuryArtikulId(hero: CharacterInfoSource): number {
  if (!Number.isInteger(hero.injuryArtikulId) || hero.injuryArtikulId < 1) {
    throw new Error(`Ghost account ${hero.accountId} is missing injury_artikul_id`);
  }
  return hero.injuryArtikulId;
}

export function areaPopulationBlock(population: readonly CharacterInfo[]): AreaPopulationBlock {
  return { status: 100, population };
}

export function populationDiff(opts: {
  add?: readonly CharacterInfo[];
  remove?: readonly string[];
}): Readonly<{ "chat|area_population_diff": PopulationDiffBlock }> {
  const hasAdd = Boolean(opts.add?.length);
  const hasRemove = Boolean(opts.remove?.length);
  if (!hasAdd && !hasRemove) throw new Error("Population diff requires add or remove");
  return {
    "chat|area_population_diff": {
      status: 100,
      ...(hasAdd ? { add: opts.add } : {}),
      ...(hasRemove ? { remove: opts.remove } : {}),
    },
  };
}
