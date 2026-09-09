export type GrantReputationCommand = Readonly<{
  characterId: number;
  objectId: number;
  amount: number;
  cap: number;
}>;

export type GrantReputationResult = Readonly<{
  objectId: number;
  value: number;
  total: number;
}>;

export type HeroReputationRow = Readonly<{
  objectId: number;
  value: number;
}>;

export interface CharacterReputation {
  grantReputation(command: GrantReputationCommand): Promise<GrantReputationResult>;
  reputations(characterId: number): Promise<readonly HeroReputationRow[]>;
}
