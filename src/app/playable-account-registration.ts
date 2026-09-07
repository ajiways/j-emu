import type { CharacterService } from "../modules/character/application/character-service.ts";
import type {
  AuthenticatedSession,
  IdentityService,
} from "../modules/identity/application/identity-service.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";

export class PlayableAccountRegistration {
  constructor(
    private readonly identity: IdentityService,
    private readonly characters: CharacterService,
    private readonly inventory: InventoryService,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async register(login: unknown, nick: unknown, password: unknown): Promise<AuthenticatedSession> {
    return this.unitOfWork.run(async () => {
      const authenticated = await this.identity.register(login, nick, password);
      const hero = await this.characters.getOrCreateForAccount(
        authenticated.account.id,
        authenticated.account.nick,
      );
      await this.inventory.ensureStarterInventory(hero.id);
      return authenticated;
    });
  }
}
