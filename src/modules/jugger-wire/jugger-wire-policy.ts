import type { ChatConfPolicy } from "./application/chat-conf-block.ts";

export type JuggerWireBootstrapPolicy = Readonly<{
  bagCapacity: number;
  pocketCapacity: number;
  chat: ChatConfPolicy;
  menuLinks: Readonly<Record<string, string>>;
}>;

export type JuggerWireFightPolicy = Readonly<{
  autoFight: number;
  canLeave: 0 | 1;
  companionEnabled: 0 | 1;
  isPvp: 0 | 1;
  instanceId: string;
  type: string;
  isSlaughter: boolean;
  flags: string;
}>;
