import { SUM_REPUTATION_OBJECT_ID } from "../../catalog/domain/reputation-ids.ts";
import type { ReputationCatalog } from "../../catalog/ports/reputation-catalog.ts";
import { CharacterNotFoundError } from "../domain/character-not-found-error.ts";
import { GhostHeroError } from "../domain/ghost-hero-error.ts";
import { reputationGrantDelta } from "../domain/reputation-grant-delta.ts";
import { SumReputationGrantError } from "../domain/sum-reputation-grant-error.ts";
import { UnknownReputationTrackError } from "../domain/unknown-reputation-track-error.ts";
import type {
  GrantReputationCommand,
  GrantReputationResult,
} from "../ports/character-reputation.ts";
import type { HeroRepository } from "../ports/hero-repository.ts";
import type { HeroReputationRepository } from "../ports/hero-reputation-repository.ts";

export async function grantHeroReputation(
  heroes: HeroRepository,
  reputations: HeroReputationRepository,
  catalog: ReputationCatalog,
  command: GrantReputationCommand,
): Promise<GrantReputationResult> {
  if (!Number.isInteger(command.characterId) || command.characterId < 1) {
    throw new Error("Character id is required");
  }
  if (!Number.isInteger(command.objectId) || command.objectId < 1) {
    throw new Error("Reputation object id is required");
  }
  if (command.objectId === SUM_REPUTATION_OBJECT_ID) throw new SumReputationGrantError();
  const hero = await heroes.lockById(command.characterId);
  if (!hero) throw new CharacterNotFoundError(command.characterId);
  if (hero.ghost) throw new GhostHeroError(command.characterId, "grantReputation");
  const track = await catalog.reputationTrack(command.objectId);
  if (!track) throw new UnknownReputationTrackError(command.objectId);
  if (track.unlockFlag) {
    throw new Error(`Reputation track ${command.objectId} unlock is not implemented`);
  }
  const rows = await reputations.listByHeroId(command.characterId);
  const current = rows.find((row) => row.objectId === command.objectId)?.value ?? 0;
  const delta = reputationGrantDelta(current, command.amount, command.cap);
  const next = current + delta;
  if (delta > 0) await reputations.upsert(command.characterId, command.objectId, next);
  const total =
    rows.reduce((sum, row) => sum + (row.objectId === command.objectId ? 0 : row.value), 0) + next;
  return { objectId: command.objectId, value: next, total };
}
