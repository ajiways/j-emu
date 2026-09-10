import type { CharacterService } from "../../../character/application/character-service.ts";
import type { MailService } from "../../../mail/application/mail-service.ts";
import { MAIL_FOLDER_INBOX } from "../../../mail/domain/mail-folder.ts";
import { buildLetterListBlock, loadMailPeers } from "../../application/letter-list-block.ts";
import type { OaCommand, OaEncodedResponse } from "./oa-command.ts";

export class PostListCommand implements OaCommand {
  static readonly key = "post|list";
  readonly key = PostListCommand.key;

  constructor(
    private readonly characters: CharacterService,
    private readonly mail: MailService,
  ) {}

  async execute(accountId: number): Promise<OaEncodedResponse> {
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    const rows = await this.mail.listInbox(hero.id);
    return {
      kind: "nested",
      value: buildLetterListBlock(
        rows,
        MAIL_FOLDER_INBOX,
        await loadMailPeers(rows, this.characters),
      ),
    };
  }
}
