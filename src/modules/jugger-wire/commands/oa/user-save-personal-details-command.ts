import type { CharacterService } from "../../../character/application/character-service.ts";
import type { BootstrapReadModel, HeroStateBlock } from "../../application/bootstrap-read-model.ts";
import type { OaCommand, OaCommandContext, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

type SavePersonalDetailsRequest = Readonly<{
  patch: Readonly<Record<string, unknown>>;
}>;

type SavePersonalDetailsBlocks = Readonly<{
  "user|save_personal_details": Readonly<{ status: 100 }>;
  state: HeroStateBlock;
}>;

export class UserSavePersonalDetailsCommand implements OaCommand {
  static readonly key = "user|save_personal_details";
  readonly key = UserSavePersonalDetailsCommand.key;

  constructor(
    private readonly characters: CharacterService,
    private readonly bootstrap: BootstrapReadModel,
  ) {}

  decode(envelope: ObjectActionEnvelope): SavePersonalDetailsRequest {
    const form = envelope.form;
    if (form === undefined) return { patch: {} };
    return { patch: form };
  }

  async handle(
    context: OaCommandContext,
    request: SavePersonalDetailsRequest,
  ): Promise<SavePersonalDetailsBlocks> {
    await this.characters.mergePersonalDetails(context.accountId, request.patch);
    const init = await this.bootstrap.init(context.accountId);
    return {
      "user|save_personal_details": { status: 100 },
      state: init.state,
    };
  }

  encode(response: SavePersonalDetailsBlocks): OaEncodedResponse {
    return { kind: "flat", blocks: response };
  }

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    return this.encode(await this.handle({ accountId }, this.decode(envelope)));
  }
}
