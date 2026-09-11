export type LearnProfessionCommand = Readonly<{
  characterId: number;
  professionId: number;
}>;

export type LearnProfessionResult = Readonly<{
  professionId: number;
  value: number;
  learned: boolean;
}>;

export type HeroProfessionLicense = Readonly<{
  professionId: number;
  value: number;
}>;

export type BumpCraftSkillCommand = Readonly<{
  characterId: number;
  professionId: number;
}>;

export interface CharacterProfessions {
  learnProfession(command: LearnProfessionCommand): Promise<LearnProfessionResult>;
  professionLicenses(characterId: number): Promise<readonly HeroProfessionLicense[]>;
  bumpCraftSkill(command: BumpCraftSkillCommand): Promise<number>;
}
