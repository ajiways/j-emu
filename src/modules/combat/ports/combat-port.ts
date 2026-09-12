import type { BattleEvent } from "../domain/battle-event.ts";
import type { CombatLoadout } from "../domain/combat-loadout.ts";
import type { HuntBotSpellBook } from "../domain/hunt-bot-spell-book.ts";
import type { FightLootBlock } from "../domain/fight-loot-block.ts";
import type { HuntHumanAppearance } from "../domain/hunt-human.ts";

type CommandSequence = string | number;

export type FightCommand =
  | Readonly<{ kind: "authenticate"; fightId: string; sequence: CommandSequence }>
  | Readonly<{
      kind: "strike";
      side: "left" | "center" | "right";
      sequence: CommandSequence;
    }>
  | Readonly<{ kind: "pocket"; itemId: number; sequence: CommandSequence }>
  | Readonly<{ kind: "glove"; spellId: number; sequence: CommandSequence }>
  | Readonly<{ kind: "rage"; sequence: CommandSequence }>
  | Readonly<{ kind: "aggro"; sequence: CommandSequence }>
  | Readonly<{ kind: "leave"; sequence: CommandSequence }>
  | Readonly<{ kind: "poll" }>;

export type FightStart = Readonly<{
  fightId: string;
  accessKey: string;
  participantId: number;
  arena: string;
}>;

export type HuntStartInput = Readonly<{
  accountId: number;
  heroId: number;
  heroNick: string;
  heroLevel: number;
  heroKind: number;
  heroHp: number;
  heroMaxHp: number;
  heroMp: number;
  heroMaxMp: number;
  heroStrength: number;
  fightId: string;
  botId: number;
  botNick: string;
  botLevel: number;
  botHp: number;
  botStrength: number;
  botAvatar: string;
  botSk: string;
  botBody: string;
  arena: string;
  areaId: string;
  instanceCopyId: number | null;
  appearance: HuntHumanAppearance;
  loadout: CombatLoadout;
  botSpellBook: HuntBotSpellBook;
  purpose: "hunt" | "quest";
  extraEnemies: readonly HuntRosterBotInput[];
  allies: readonly HuntRosterBotInput[];
  chatWin: string;
  chatLose: string;
}>;

export type HuntRosterBotInput = Readonly<{
  artikulId: number;
  nick: string;
  level: number;
  hp: number;
  strength: number;
  avatar: string;
  sk: string;
  body: string;
  spellBook: HuntBotSpellBook;
}>;

export type HuntJoinInput = Readonly<{
  accountId: number;
  heroId: number;
  heroNick: string;
  heroLevel: number;
  heroKind: number;
  heroHp: number;
  heroMaxHp: number;
  heroMp: number;
  heroMaxMp: number;
  heroStrength: number;
  fightId: string;
  areaId: string;
  instanceCopyId: number | null;
  team: 1 | 2;
  appearance: HuntHumanAppearance;
  loadout: CombatLoadout;
}>;

export type CombatEvent =
  | BattleEvent
  | Readonly<{ type: "command-accepted"; sequence: CommandSequence; accessKey?: string }>;

export type FightExit = Readonly<{
  fightId: string;
  winnerTeam: 1 | 2;
  flee?: true;
}>;

export type FriendlyDuelStartInput = Readonly<{
  challenger: FriendlyDuelFighterInput;
  acceptor: FriendlyDuelFighterInput;
  fightId: string;
  arena: string;
  areaId: string;
}>;

type FriendlyDuelFighterInput = Readonly<{
  accountId: number;
  heroId: number;
  heroNick: string;
  heroLevel: number;
  heroKind: number;
  heroHp: number;
  heroMaxHp: number;
  heroMp: number;
  heroMaxMp: number;
  heroStrength: number;
  loadout: CombatLoadout;
  avatar: string;
  body: string;
  sk: string;
}>;

export interface CombatPort {
  nextFightId(): Promise<string>;
  startHunt(input: HuntStartInput): Promise<FightStart>;
  joinHunt(input: HuntJoinInput): Promise<FightStart>;
  startFriendlyDuel(input: FriendlyDuelStartInput): Promise<FightStart>;
  startPvp(input: FriendlyDuelStartInput): Promise<FightStart>;
  hasFight(fightId: string): Promise<boolean>;
  participantTeam(accountId: number): Promise<1 | 2 | null>;
  execute(accountId: number, command: FightCommand): Promise<readonly CombatEvent[]>;
  takePocketConsume(accountId: number): number | null;
  activeFightId(accountId: number): Promise<string | null>;
  resumeFight(accountId: number): Promise<FightStart | null>;
  accountForFight(fightId: string): Promise<number | null>;
  takeExit(accountId: number): Promise<FightExit | null>;
  peekExit(accountId: number): Promise<FightExit | null>;
  takeLoot(accountId: number): Promise<FightLootBlock | null>;
  peekLoot(accountId: number): Promise<FightLootBlock | null>;
}
