import type { HuntHumanSnap } from "./hunt-human.ts";

export type HuntBotSnap = Readonly<{
  id: number;
  nick: string;
  level: number;
  hp: number;
  maxHp: number;
  artikulId: number;
  avatar: string;
  sk: string;
  body: string;
  team: 2;
}>;

export type BattleEvent =
  | Readonly<{
      type: "hunt-bootstrap";
      waiting: boolean;
      hero: HuntHumanSnap;
      allies: readonly HuntHumanSnap[];
      bot: HuntBotSnap;
    }>
  | Readonly<{
      type: "roster-updated";
      humans: readonly HuntHumanSnap[];
      bot: HuntBotSnap;
      joined: HuntHumanSnap;
    }>
  | Readonly<{
      type: "damage";
      sourceId: number;
      targetId: number;
      animation: string;
      hpChange: number;
      targetMaxHp: number;
      killed: boolean;
    }>
  | Readonly<{ type: "turn-granted"; timeoutSeconds: number }>
  | Readonly<{ type: "finished"; winnerTeam: 1 | 2; fightId: string }>;
