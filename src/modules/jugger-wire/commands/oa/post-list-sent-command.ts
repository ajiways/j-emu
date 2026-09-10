import type { CharacterService } from "../../../character/application/character-service.ts";
import type { MailService } from "../../../mail/application/mail-service.ts";
import { MAIL_FOLDER_OUTBOX } from "../../../mail/domain/mail-folder.ts";
import { buildLetterListBlock, loadMailPeers } from "../../application/letter-list-block.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class PostListSentCommand implements OaCommand {
  static readonly key = "post|list_sent";
  readonly key = PostListSentCommand.key;

  constructor(
    private readonly characters: CharacterService,
    private readonly mail: MailService,
  ) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    const rows = await this.mail.listOutbox(hero.id);
    return {
      kind: "nested",
      value: buildLetterListBlock(
        rows,
        MAIL_FOLDER_OUTBOX,
        await loadMailPeers(rows, this.characters),
      ),
    };
  }
}
