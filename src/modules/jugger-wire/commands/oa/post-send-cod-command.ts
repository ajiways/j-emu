import type { MailSend } from "../../../../app/mail-send.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import { MailDeniedError } from "../../../mail/domain/mail-denied-error.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import { postSendMutation } from "../../application/post-send-mutation.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";
import {
  enclosedGold,
  parseMailAttachments,
  stringField,
  truthyMailField,
} from "./post-mail-form.ts";

export class PostSendCodCommand implements OaCommand {
  static readonly key = "post|send_cod";
  readonly key = PostSendCodCommand.key;

  constructor(
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly send: MailSend,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      const hero = await this.characters.getByAccountId(accountId);
      if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
      const form = envelope.form;
      if (truthyMailField(form?.send_clan_members)) {
        throw new MailDeniedError("кланы не поддерживаются");
      }
      await this.send.send({
        fromHeroId: hero.id,
        nick: stringField(form?.nick),
        subject: stringField(form?.subject),
        text: stringField(form?.text),
        moneyGold: enclosedGold(form?.money),
        attachments: parseMailAttachments(form?.attachment),
        cod: true,
      });
      return {
        kind: "flat",
        blocks: postSendMutation(
          "post|send_cod",
          await this.bootstrap.bag(accountId),
          await this.bootstrap.state(accountId),
        ),
      };
    } catch (error) {
      if (error instanceof MailDeniedError) throw new ProtocolError(203, error.message);
      throw error;
    }
  }
}
