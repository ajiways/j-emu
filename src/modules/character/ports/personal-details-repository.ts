import type { PersonalDetails } from "../domain/personal-details.ts";

export interface PersonalDetailsRepository {
  findByHeroId(heroId: number): Promise<PersonalDetails | null>;
  save(heroId: number, details: PersonalDetails): Promise<void>;
}
