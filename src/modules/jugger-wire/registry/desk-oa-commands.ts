import type { AssistantDesk } from "../../../app/assistant-desk.ts";
import type { BattlegroundDesk } from "../../../app/battleground-desk.ts";
import type { BookDesk } from "../../../app/book-desk.ts";
import type { CraftDesk } from "../../../app/craft-desk.ts";
import type { PartyDesk } from "../../../app/party-desk.ts";
import { ArenaOaCommand, ARENA_OA_KEYS } from "../commands/oa/arena-oa-command.ts";
import { AssistantOaCommand, ASSISTANT_OA_KEYS } from "../commands/oa/assistant-oa-command.ts";
import { BookOaCommand, BOOK_OA_KEYS } from "../commands/oa/book-oa-command.ts";
import { CraftOaCommand, CRAFT_OA_KEYS } from "../commands/oa/craft-oa-command.ts";
import type { OaCommand } from "../commands/oa/oa-command.ts";
import { PartyOaCommand, PARTY_OA_KEYS } from "../commands/oa/party-oa-command.ts";

export function deskOaCommands(input: {
  party: PartyDesk;
  battleground: BattlegroundDesk;
  book: BookDesk;
  assistants: AssistantDesk;
  craft: CraftDesk;
}): OaCommand[] {
  return [
    ...PARTY_OA_KEYS.map((key) => new PartyOaCommand(key, input.party)),
    ...ARENA_OA_KEYS.map((key) => new ArenaOaCommand(key, input.battleground)),
    ...BOOK_OA_KEYS.map((key) => new BookOaCommand(key, input.book)),
    ...ASSISTANT_OA_KEYS.map((key) => new AssistantOaCommand(key, input.assistants)),
    ...CRAFT_OA_KEYS.map((key) => new CraftOaCommand(key, input.craft)),
  ];
}
