import { parseDecimalId } from "../../../shared/kernel/decimal-id.ts";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { nextSequenceText } from "../../../infrastructure/postgres/next-sequence.ts";
import type { FightIdSource } from "../ports/fight-id-source.ts";

export class PostgresFightIdSource implements FightIdSource {
  constructor(private readonly database: PostgresDatabase) {}

  async nextFightId(): Promise<string> {
    const raw = await nextSequenceText(this.database.session(), "combat.fight_id_seq");
    return parseDecimalId(raw, "fight id").toString();
  }

  async nextParticipantId(): Promise<bigint> {
    const raw = await nextSequenceText(this.database.session(), "combat.participant_id_seq");
    return parseDecimalId(raw, "participant id");
  }
}
