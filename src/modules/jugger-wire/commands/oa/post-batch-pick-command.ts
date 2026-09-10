import type { MailClaim } from "../../../../app/mail-claim.ts";
import type { Catalog } from "../../../catalog/ports/catalog.ts";
import type { CharacterService } from "../../../character/application/character-service.ts";
import type { MailService } from "../../../mail/application/mail-service.ts";
import { MAIL_FOLDER_INBOX } from "../../../mail/domain/mail-folder.ts";
import { MailDeniedError } from "../../../mail/domain/mail-denied-error.ts";
import type { BootstrapReadModel } from "../../application/bootstrap-read-model.ts";
import { ProtocolError } from "../../application/protocol-error.ts";
import { buildLetterListBlock, loadMailPeers } from "../../application/letter-list-block.ts";
import { postBatchPickMutation } from "../../application/post-claim-mutation.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";
import type { ObjectActionEnvelope } from "./object-action-envelope.ts";
import { parseMailIds } from "./post-mail-form.ts";

export class PostBatchPickCommand implements OaCommand {
  static readonly key = "post|batch_pick";
  readonly key = PostBatchPickCommand.key;

  constructor(
    private readonly bootstrap: BootstrapReadModel,
    private readonly characters: CharacterService,
    private readonly mail: MailService,
    private readonly claim: MailClaim,
    private readonly catalog: Catalog,
  ) {}

  async execute(accountId: number, envelope: ObjectActionEnvelope): Promise<OaEncodedResponse> {
    try {
      const hero = await this.characters.getByAccountId(accountId);
      if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
      await this.claim.batchPick({
        heroId: hero.id,
        letterIds: parseMailIds(envelope.form?.ids),
      });
      const rows = await this.mail.listInbox(hero.id);
      return {
        kind: "flat",
        blocks: postBatchPickMutation(
          await buildLetterListBlock(
            rows,
            MAIL_FOLDER_INBOX,
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
