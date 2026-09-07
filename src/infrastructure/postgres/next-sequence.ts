import { sql } from "drizzle-orm";
import { fightIdSeq, participantIdSeq } from "../../modules/combat/infrastructure/schema.ts";
import { itemIdSeq } from "../../modules/inventory/infrastructure/schema.ts";
import type { DatabaseSession } from "./database.ts";

const sequences = {
  "inventory.item_id_seq": itemIdSeq,
  "combat.fight_id_seq": fightIdSeq,
  "combat.participant_id_seq": participantIdSeq,
} as const;

export async function nextSequenceText(
  session: DatabaseSession,
  qualifiedName: keyof typeof sequences,
): Promise<string> {
  const sequence = sequences[qualifiedName];
  if (!sequence.schema || !sequence.seqName) {
    throw new Error(`Sequence ${qualifiedName} is missing schema or name`);
  }
  const actual = `${sequence.schema}.${sequence.seqName}`;
  if (actual !== qualifiedName) {
    throw new Error(`Sequence ${qualifiedName} is registered as ${actual}`);
  }
  // Drizzle has no typed nextval that returns decimal text. Fight/participant
  // IDs must not pass through JS number; `::text` keeps the full bigint.
  const result = await session.execute<{ id: string }>(
    sql`SELECT nextval(${qualifiedName}::regclass)::text AS id`,
  );
  const row = result[0];
  if (result.length !== 1 || !row?.id) {
    throw new Error(`${qualifiedName} returned an invalid result`);
  }
  return row.id;
}
