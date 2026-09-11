import type { CatalogProgression } from "../../catalog/ports/catalog-progression.ts";
import type { HonorRanks } from "../../catalog/ports/honor-ranks.ts";
import { honorProgress, type HonorProgress } from "../../catalog/domain/honor-progress.ts";
import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import { CharacterNotFoundError } from "../domain/character-not-found-error.ts";
import { HonorGrantConflictError } from "../domain/honor-grant-conflict-error.ts";
import type { HonorGrantCommand } from "../domain/honor-grant-command.ts";
import type { HonorGrantResult } from "../domain/honor-grant-result.ts";
import { loadProgressionSnapshot } from "../domain/load-progression-snapshot.ts";
import { parseHonorGrantCommand, requireHonorSum } from "../domain/parse-honor-grant-command.ts";
import { ProgressionContentError } from "../domain/progression-content-error.ts";
import type { HonorGrantRepository } from "../ports/honor-grant-repository.ts";
import type { HeroRepository } from "../ports/hero-repository.ts";

export class HonorGrantService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly heroes: HeroRepository,
    private readonly grants: HonorGrantRepository,
    private readonly honorRanks: HonorRanks,
    private readonly progression: CatalogProgression,
  ) {}

  grantHonor(command: HonorGrantCommand): Promise<HonorGrantResult> {
    const parsed = parseHonorGrantCommand(command);
    return this.unitOfWork.run(() => this.apply(parsed));
  }

  private async apply(command: HonorGrantCommand): Promise<HonorGrantResult> {
    const locked = await this.heroes.lockById(command.characterId);
    if (!locked) throw new CharacterNotFoundError(command.characterId);
    const existing = await this.grants.find(locked.id, command.operationId);
    if (existing && existing.amount !== command.amount) {
      throw new HonorGrantConflictError(command.operationId);
    }
    if (existing) return toResult(existing);
    const hero = await this.heroes.lockById(command.characterId);
    if (!hero) throw new CharacterNotFoundError(command.characterId);
    const catalog = await this.requireCatalog();
    const snapshot = await loadProgressionSnapshot(this.progression);
    const before = honorProgress(catalog, hero.honor, hero.level);
    const want = requireHonorSum(before.honor, command.amount);
    const after = honorProgress(catalog, want, hero.level);
    hero.applyHonor(after.honor);
    const result = grantResult(before, after, snapshot.contentReleaseId);
    await this.heroes.save(hero);
    await this.grants.insert({
      heroId: hero.id,
      operationId: command.operationId,
      amount: command.amount,
      ...result,
    });
    return result;
  }

  private async requireCatalog() {
    try {
      return await this.honorRanks.honorRankCatalog();
    } catch (error) {
      throw new ProgressionContentError(
        error instanceof Error ? error.message : "Honor rank catalog is invalid",
      );
    }
  }
}

function grantResult(
  before: HonorProgress,
  after: HonorProgress,
  contentReleaseId: string,
): HonorGrantResult {
  return {
    honorBefore: before.honor,
    honorAfter: after.honor,
    added: after.honor - before.honor,
    rank: after.rank,
    honorMin: after.honorMin,
    honorMax: after.honorMax,
    honorStatus: after.honorStatus,
    contentReleaseId,
  };
}

function toResult(
  grant: HonorGrantResult & Readonly<{ heroId: number; operationId: string; amount: number }>,
): HonorGrantResult {
  return {
    honorBefore: grant.honorBefore,
    honorAfter: grant.honorAfter,
    added: grant.added,
    rank: grant.rank,
    honorMin: grant.honorMin,
    honorMax: grant.honorMax,
    honorStatus: grant.honorStatus,
    contentReleaseId: grant.contentReleaseId,
  };
}
