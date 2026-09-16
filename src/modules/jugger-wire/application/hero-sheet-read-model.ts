import type { ChatConfBlock, ChatConfPolicy } from "./chat-conf-block.ts";
import { buildChatConf } from "./chat-conf-block.ts";
import type { BookTrioBlocks } from "./book-quest-blocks.ts";
import { emptyBookTrio } from "./book-quest-blocks.ts";
import type { MenuLinkStatusBlock } from "./menu-link-status-block.ts";
import { buildMenuLinkStatus } from "./menu-link-status-block.ts";

type HeroSheetPolicy = Readonly<{
  chat: ChatConfPolicy;
  menuLinks: Readonly<Record<string, string>>;
}>;

export class HeroSheetReadModel {
  constructor(private readonly policy: HeroSheetPolicy) {}

  get menuLinkStatus(): MenuLinkStatusBlock {
    return buildMenuLinkStatus(this.policy.menuLinks);
  }

  chatConf(accountId: number): ChatConfBlock {
    return buildChatConf(accountId, this.policy.chat);
  }

  bookTrio(filterType: string): BookTrioBlocks {
    return emptyBookTrio(filterType);
  }
}
