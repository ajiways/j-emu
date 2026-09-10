import type { CharacterService } from "../../../character/application/character-service.ts";
import { userProfessionsWire } from "../../../character/domain/profession-wire.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class UserProfessionsCommand implements OaCommand {
  static readonly key = "user|professions";
  readonly key = UserProfessionsCommand.key;

  constructor(private readonly characters: CharacterService) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    void envelope;
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    try {
      const rows = await this.characters.professionLicenses(hero.id);
      return { kind: "nested", value: userProfessionsWire(rows, hero.level) };
    } catch (error) {
      if (error instanceof ProtocolError) throw error;
      if (error instanceof Error) throw new ProtocolError(204, error.message);
      throw error;
    }
  }
}
