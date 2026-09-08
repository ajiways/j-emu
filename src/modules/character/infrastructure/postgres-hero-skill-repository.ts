import { eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { requireHeroSkills, type HeroSkill } from "../domain/hero-skill.ts";
import type { HeroSkillRepository } from "../ports/hero-skill-repository.ts";
import { heroSkills } from "./schema.ts";

export class PostgresHeroSkillRepository implements HeroSkillRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async list(heroId: number): Promise<readonly HeroSkill[]> {
    const rows = await this.database
      .session()
      .select()
      .from(heroSkills)
      .where(eq(heroSkills.heroId, heroId));
    return requireHeroSkills(
      rows.map((row) => ({
        id: row.skillId,
        value: row.value,
      })),
    );
  }

  async replace(heroId: number, skills: readonly HeroSkill[]): Promise<void> {
    const next = requireHeroSkills(skills);
    const session = this.database.session();
    await session.delete(heroSkills).where(eq(heroSkills.heroId, heroId));
    await session.insert(heroSkills).values(
      next.map((skill) => ({
        heroId,
        skillId: skill.id,
        value: skill.value,
      })),
    );
  }
}
