export type HeroProfessionValue = Readonly<{
  professionId: number;
  value: number;
}>;

export interface HeroProfessionRepository {
  listByHeroId(heroId: number): Promise<readonly HeroProfessionValue[]>;
  insertLicense(heroId: number, professionId: number, value: number): Promise<void>;
}
