import type { Catalog } from "../../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { MailService } from "../../../mail/application/mail-service.ts";
import { MAIL_FOLDER_OUTBOX } from "../../../mail/domain/mail-folder.ts";
import { MailDeniedError } from "../../../mail/domain/mail-denied-error.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import { buildLetterListBlock, loadMailPeers } from "../../application/letter-list-block.ts";
import { postDeleteMutation } from "../../application/post-delete-mutation.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";

export class PostDeleteCommand implements OaCommand {
  static readonly key = "post|delete";
  readonly key = PostDeleteCommand.key;

  constructor(
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly mail: MailService,
    private readonly catalog: Catalog,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      const hero = await this.characters.getByAccountId(accountId);
      if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
      const id = Number(envelope.form?.id);
      if (!Number.isInteger(id) || id < 1) throw new MailDeniedError("письмо не найдено");
      const folder = await this.mail.delete(hero.id, id);
      const listKey = folder === MAIL_FOLDER_OUTBOX ? "post|list_sent" : "post|list";
      const rows = await this.mail.list(hero.id, folder);
      return {
        kind: "flat",
        blocks: postDeleteMutation(
          listKey,
          await buildLetterListBlock(
            rows,
            folder,
            await loadMailPeers(rows, this.characters),
            this.catalog,
          ),
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
