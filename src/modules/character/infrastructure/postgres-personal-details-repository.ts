import { eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { PersonalDetails } from "../domain/personal-details.ts";
import type { PersonalDetailsRepository } from "../ports/personal-details-repository.ts";
import { heroPersonalDetails } from "./schema.ts";

export class PostgresPersonalDetailsRepository implements PersonalDetailsRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async findByHeroId(heroId: number): Promise<PersonalDetails | null> {
    const rows = await this.database
      .session()
      .select()
      .from(heroPersonalDetails)
      .where(eq(heroPersonalDetails.heroId, heroId));
    if (rows.length > 1) throw new Error(`Multiple personal details rows for hero ${heroId}`);
    const row = rows[0];
    if (!row) return null;
    if (row.schemaVersion !== PersonalDetails.SCHEMA_VERSION) {
      throw new Error(
        `Unsupported personal details schema version ${row.schemaVersion} for hero ${heroId}`,
      );
    }
    return PersonalDetails.fromStored(row.info);
  }

  async save(heroId: number, details: PersonalDetails): Promise<void> {
    await this.database
      .session()
      .insert(heroPersonalDetails)
      .values({
        heroId,
        info: { ...details.info },
        schemaVersion: PersonalDetails.SCHEMA_VERSION,
      })
      .onConflictDoUpdate({
        target: heroPersonalDetails.heroId,
        set: {
          info: { ...details.info },
          schemaVersion: PersonalDetails.SCHEMA_VERSION,
        },
      });
  }
}
