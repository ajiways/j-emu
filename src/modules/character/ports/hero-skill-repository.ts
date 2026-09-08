import type { HeroSkill } from "../domain/hero-skill.ts";

export interface HeroSkillRepository {
  list(heroId: number): Promise<readonly HeroSkill[]>;
  replace(heroId: number, skills: readonly HeroSkill[]): Promise<void>;
}
