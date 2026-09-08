import type { CharacterInfo } from "./character-info.ts";

export type PresenceNotice = Readonly<{
  recipientAccountIds: readonly number[];
  add?: CharacterInfo;
  removeNick?: string;
}>;
