import type { CharacterService } from "../modules/character/application/character-service.ts";
import type {
  EstablishedSession,
  IdentityService,
} from "../modules/identity/application/identity-service.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { PresenceFanout } from "../modules/jugger-wire/application/presence-fanout.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";

export class PlayableDevelopmentIdentity {
  constructor(
    private readonly identity: IdentityService,
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly unitOfWork: UnitOfWork,
    private readonly presence: PresenceFanout,
  ) {}

  async create(slot: number): Promise<EstablishedSession> {
    const authenticated = await this.unitOfWork.run(async () => {
      const session = await this.identity.createDevelopmentIdentity(slot);
      const hero = await this.characters.getOrCreateForAccount(
        session.account.id,
        session.account.nick,
      );
      await this.inventory.ensureStarterInventory(hero.id);
      return session;
    });
    await this.presence.afterSessionCommitted(
      authenticated.account.id,
      authenticated.replacedExisting,
    );
    return authenticated;
  }
}
