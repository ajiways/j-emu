import type { PostgresDatabase } from "../infrastructure/postgres/database.ts";
import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { IdentityService } from "../modules/identity/application/identity-service.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import type { MailService } from "../modules/mail/application/mail-service.ts";
import type { PresenceFanout } from "../modules/jugger-wire/application/presence-fanout.ts";
import { MailClaim } from "./mail-claim.ts";
import { MailSend } from "./mail-send.ts";
import { PlayableAccountRegistration } from "./playable-account-registration.ts";
import { PlayableDevelopmentIdentity } from "./playable-development-identity.ts";

export function createPlayableIdentity(input: {
  identity: IdentityService;
  characters: CharacterService;
  inventory: InventoryService;
  database: PostgresDatabase;
  presenceFanout: PresenceFanout;
  mail: MailService;
  catalog: Catalog;
}) {
  return {
    registration: new PlayableAccountRegistration(
      input.identity,
      input.characters,
      input.inventory,
      input.database,
      input.presenceFanout,
    ),
    developmentIdentity: new PlayableDevelopmentIdentity(
      input.identity,
      input.characters,
      input.inventory,
      input.database,
      input.presenceFanout,
    ),
    mailSend: new MailSend(
      input.database,
      input.characters,
      input.mail,
      input.inventory,
      input.catalog,
    ),
    mailClaim: new MailClaim(input.database, input.characters, input.mail, input.inventory),
  };
}
