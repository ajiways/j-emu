import type { PostgresDatabase } from "../../infrastructure/postgres/database.ts";
import { requirePresent } from "../../shared/kernel/require-present.ts";
import { CombatService } from "./application/combat-service.ts";
import type { BattleRules } from "./domain/battle.ts";
import { SystemRandomSource } from "./domain/system-random-source.ts";
import { PostgresFightIdSource } from "./infrastructure/postgres-fight-id-source.ts";
import type { CombatPort } from "./ports/combat-port.ts";

export class CombatModule {
  private constructor(
    readonly combat: CombatPort,
    private readonly runtime: CombatService,
  ) {}

  static create(input: { database: PostgresDatabase; rules: BattleRules }): CombatModule {
    const database = requirePresent(input.database, "Combat module requires a database");
    const rules = requirePresent(input.rules, "Combat module requires battle rules");
    const runtime = new CombatService(
      new PostgresFightIdSource(database),
      new SystemRandomSource(),
      rules,
    );
    return new CombatModule(runtime, runtime);
  }

  async close(): Promise<void> {
    this.runtime.shutdown();
  }
}
