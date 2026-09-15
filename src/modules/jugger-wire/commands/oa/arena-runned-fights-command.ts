import type { CharacterService } from "../../../character/application/character-service.ts";
import type { CombatPort } from "../../../combat/ports/combat-port.ts";
import { runnedFightListPayload } from "../../application/runned-fight-list-payload.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";
import { parseFightBoardForm } from "./fight-board-form.ts";

export class ArenaRunnedFightsCommand implements OaCommand {
  static readonly key = "arena|runned_fights";
  readonly key = ArenaRunnedFightsCommand.key;

  constructor(
    private readonly combat: CombatPort,
    private readonly characters: CharacterService,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    const page = await this.combat.listRunnedFights({
      areaId: hero.areaId,
      ...parseFightBoardForm(envelope, ArenaRunnedFightsCommand.key),
    });
    return { kind: "nested", value: runnedFightListPayload(page, hero.id) };
  }
}
