import { asc, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type {
  HeroProfessionRepository,
  HeroProfessionValue,
} from "../ports/hero-profession-repository.ts";
import { heroProfessions } from "./schema.ts";

export class PostgresHeroProfessionRepository implements HeroProfessionRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async listByHeroId(heroId: number): Promise<readonly HeroProfessionValue[]> {
    if (!Number.isInteger(heroId) || heroId < 1) throw new Error("Hero id is required");
    const rows = await this.database
      .session()
      .select()
      .from(heroProfessions)
      .where(eq(heroProfessions.heroId, heroId))
      .orderBy(asc(heroProfessions.professionId));
    return rows.map((row) => {
      if (!Number.isInteger(row.value) || row.value < 1) {
        throw new Error(`Profession ${row.professionId} value is missing`);
      }
      return { professionId: row.professionId, value: row.value };
    });
  }

  async insertLicense(heroId: number, professionId: number, value: number): Promise<void> {
    if (!Number.isInteger(heroId) || heroId < 1) throw new Error("Hero id is required");
    if (!Number.isInteger(professionId) || professionId < 1) {
      throw new Error("Profession id is required");
    }
    if (!Number.isInteger(value) || value < 1) {
      throw new Error("Profession value must be a positive integer");
    }
    await this.database.session().insert(heroProfessions).values({ heroId, professionId, value });
  }
}
