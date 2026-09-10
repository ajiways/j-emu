import type { HuntHumanSnap } from "../../combat/domain/hunt-human.ts";

export function humanOppNewEvent(
  human: HuntHumanSnap,
  appearance: Readonly<{ avatar: string; body: string; sk: string }>,
): Readonly<Record<string, unknown>> {
  if (!appearance.avatar) throw new Error("Human opponent avatar is required");
  if (!appearance.sk) throw new Error("Human opponent sk is required");
  return {
    avatar: appearance.avatar,
    body: appearance.body,
    dead: human.hp <= 0,
    et: "oppnew",
    hp: human.hp,
    id: human.id,
    juggernaut: false,
    level: human.level,
    maxHp: human.maxHp,
    maxMp: human.maxMp,
    mp: human.mp,
    nick: human.nick,
    sk: appearance.sk,
    team: human.team,
  };
}
