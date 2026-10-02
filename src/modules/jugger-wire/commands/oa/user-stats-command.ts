import { DAILY_CYCLE_RULES, lastMoscow6am } from "../../../quests/domain/daily-cycle-rules.ts";
import type { Clock } from "../../../../shared/kernel/clock.ts";
import type { Catalog } from "../../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { ProfessionsService } from "../../../professions/application/professions-service.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import { buildUserStatsBlock } from "../../application/user-stats-block.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class UserStatsCommand implements OaCommand {
  static readonly key = "user|stats";
  readonly key = UserStatsCommand.key;

  constructor(
    private readonly characters: CharacterService,
    private readonly catalog: Catalog,
    private readonly professions: ProfessionsService,
    private readonly clock: Clock,
  ) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    try {
      const rows = await this.characters.reputations(hero.id);
      return {
        kind: "nested",
        value: await buildUserStatsBlock(
          hero,
          rows,
          this.catalog,
          await this.professions.farmStats(hero.id),
          await this.characters.read(
            hero.id,
            lastMoscow6am(this.clock.unixSeconds(), DAILY_CYCLE_RULES),
          ),
        ),
      };
    } catch (error) {
      if (error instanceof ProtocolError) throw error;
      if (error instanceof Error) throw new ProtocolError(204, error.message);
      throw error;
    }
  }
}
