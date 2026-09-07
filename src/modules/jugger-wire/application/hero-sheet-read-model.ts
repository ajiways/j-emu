import type { CharacterService } from "../../character/application/character-service.ts";
import type { ChatConfBlock, ChatConfPolicy } from "./chat-conf-block.ts";
import { buildChatConf } from "./chat-conf-block.ts";
import type { BookTrioBlocks } from "./book-quest-blocks.ts";
import { emptyBookTrio } from "./book-quest-blocks.ts";
import type { MenuLinkStatusBlock } from "./menu-link-status-block.ts";
import { buildMenuLinkStatus } from "./menu-link-status-block.ts";
import { emptyUserMagic, type UserMagicBlock } from "./user-magic-block.ts";
import { buildUserView, type PaperdollPolicy, type UserViewBlock } from "./user-view-block.ts";

type HeroSheetPolicy = Readonly<{
  view: PaperdollPolicy;
  chat: ChatConfPolicy;
  menuLinks: Readonly<Record<string, string>>;
}>;

export class HeroSheetReadModel {
  constructor(
    private readonly characters: CharacterService,
    private readonly policy: HeroSheetPolicy,
  ) {}

  get menuLinkStatus(): MenuLinkStatusBlock {
    return buildMenuLinkStatus(this.policy.menuLinks);
  }

  chatConf(accountId: number): ChatConfBlock {
    return buildChatConf(accountId, this.policy.chat);
  }

  magic(): UserMagicBlock {
    return emptyUserMagic();
  }

  bookTrio(filterType: string): BookTrioBlocks {
    return emptyBookTrio(filterType);
  }

  async view(accountId: number): Promise<UserViewBlock> {
    return buildUserView(await this.requireHero(accountId), this.policy.view);
  }

  private async requireHero(accountId: number) {
    const hero = await this.characters.getByAccountId(accountId);
    if (!hero) throw new Error(`Hero for account ${accountId} is missing`);
    return hero;
  }
}
