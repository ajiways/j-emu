import type { FinishedFightTeams } from "./finished-fight-teams.ts";
import { parseFinishedFightTeams } from "./finished-fight-teams.ts";

export function practiceFinishedFightTeams(input: {
  challengerId: number;
  challengerNick: string;
  challengerLevel: number;
  challengerKind: number;
  challengerDead: boolean;
  challengerFlee: 0 | 1;
  acceptorId: number;
  acceptorNick: string;
  acceptorLevel: number;
  acceptorKind: number;
  acceptorDead: boolean;
  acceptorFlee: 0 | 1;
}): FinishedFightTeams {
  return parseFinishedFightTeams({
    "1": [
      practiceHuman(
        input.challengerId,
        input.challengerNick,
        input.challengerLevel,
        input.challengerKind,
        input.challengerDead,
        input.challengerFlee,
      ),
    ],
    "2": [
      practiceHuman(
        input.acceptorId,
        input.acceptorNick,
        input.acceptorLevel,
        input.acceptorKind,
        input.acceptorDead,
        input.acceptorFlee,
      ),
    ],
  });
}

function practiceHuman(
  id: number,
  nick: string,
  level: number,
  kind: number,
  dead: boolean,
  flee: 0 | 1,
) {
  return {
    id,
    nick,
    level,
    kind,
    instance_id: 0 as const,
    gag_time: 0 as const,
    gag_reason: 0 as const,
    clan_id: 0 as const,
    injury_time: 0 as const,
    injury_artikul_id: 0 as const,
    server_id: 1 as const,
    language: "ru" as const,
    nick_color: 0 as const,
    nick_color_expire: 0 as const,
    punish: 0 as const,
    dead,
    juggernaut: 0 as const,
    flee,
    bot: 0 as const,
    me: 0 as const,
  };
}
