import type { Catalog } from "../modules/catalog/ports/catalog.ts";
import type { CharacterService } from "../modules/character/application/character-service.ts";
import type { CombatPort } from "../modules/combat/ports/combat-port.ts";
import type { InventoryService } from "../modules/inventory/domain/inventory-service.ts";
import { bootstrapFightId } from "../modules/jugger-wire/application/bootstrap-hero-state.ts";
import type { EsrvOutbox } from "../modules/jugger-wire/application/esrv-outbox.ts";
import { liveHonorProgress } from "../modules/jugger-wire/application/live-honor-progress.ts";
import { buildUserUnitframe } from "../modules/jugger-wire/application/user-unitframe-block.ts";
import { withSyncedResources } from "../modules/jugger-wire/application/with-synced-resources.ts";
import { wornSetPortrait } from "../modules/jugger-wire/application/worn-set-portrait.ts";
import type { UnitOfWork } from "../shared/kernel/unit-of-work.ts";
import type { FightExperienceHud } from "./chat-fight-settlement.ts";

export class HuntKillExperienceHud implements FightExperienceHud {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly characters: CharacterService,
    private readonly catalog: Catalog,
    private readonly inventory: InventoryService,
    private readonly combat: CombatPort,
    private readonly outbox: EsrvOutbox,
    private readonly wake: Readonly<{ wake(accountId: number): void }>,
  ) {}

  async push(accountId: number): Promise<void> {
    const fragment = await withSyncedResources(
      this.unitOfWork,
      this.characters,
      accountId,
      async () => {
        const hero = await this.characters.getByAccountId(accountId);
        if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
        const level = await this.catalog.level(hero.level);
        const appearance = await this.catalog.appearance(hero.kind, hero.gender);
        const hud = await this.catalog.hudDefaults();
        const fightId = await bootstrapFightId(this.combat, accountId);
        const portrait = await wornSetPortrait(
          await this.inventory.list(hero.id),
          this.catalog,
          hero.gender,
        );
        return {
          "user|unitframe": buildUserUnitframe(
            hero,
            level,
            appearance,
            hud,
            await liveHonorProgress(this.catalog, hero),
            fightId !== null,
            fightId,
            portrait === null ? appearance.avatarSmall : portrait.small,
          ),
        };
      },
    );
    this.outbox.enqueue(accountId, fragment);
    this.wake.wake(accountId);
  }
}
