import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../character/application/character-service.ts";
import type { UnitOfWork } from "../../../shared/kernel/unit-of-work.ts";
import { buildUserConf } from "./user-conf-block.ts";
import type { BootstrapReadModel } from "./bootstrap-read-model.ts";
import type { EsrvOutbox } from "./esrv-outbox.ts";
import { liveHonorProgress } from "./live-honor-progress.ts";
import { withSyncedResources } from "./with-synced-resources.ts";

export class HeroHudPush {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly characters: CharacterService,
    private readonly catalog: Catalog,
    private readonly bootstrap: BootstrapReadModel,
    private readonly outbox: EsrvOutbox,
    private readonly wake: Readonly<{ wake(accountId: number): void }>,
  ) {}

  fragment(accountId: number): Promise<Readonly<Record<string, unknown>>> {
    return withSyncedResources(this.unitOfWork, this.characters, accountId, async () => {
      const hero = await this.characters.getByAccountId(accountId);
      if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
      return {
        "user|unitframe": await this.bootstrap.unitframe(accountId),
        "user|conf": buildUserConf(hero, await liveHonorProgress(this.catalog, hero)),
        "user|bag": await this.bootstrap.bag(accountId),
        state: await this.bootstrap.state(accountId),
      };
    });
  }

  async enqueue(accountId: number): Promise<void> {
    this.outbox.enqueue(accountId, await this.fragment(accountId));
    this.wake.wake(accountId);
  }

  async enqueueHero(heroId: number): Promise<void> {
    const hero = await this.characters.getById(heroId);
    if (!hero) throw new Error(`Hero ${heroId} is missing`);
    await this.enqueue(hero.accountId);
  }
}
