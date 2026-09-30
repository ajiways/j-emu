import type { BotFighter } from "./bot-fighter.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { Participant } from "./participant.ts";

/**
 * Everyone who fights, players and mobs in one list. A participant never leaves it: he stays
 * dead, waiting or gone. `humans` and `bots` are views of that one list kept in join order;
 * they are the same arrays for as long as the roster lives, so a participant joining shows in
 * them at once.
 */
export class Roster {
  private readonly members: Participant[] = [];
  readonly humans: HumanFighter[] = [];
  readonly bots: BotFighter[] = [];

  add(participant: Participant): void {
    if (this.members.some((member) => member.id === participant.id)) {
      throw new Error(`Participant id ${participant.id} collides`);
    }
    this.members.push(participant);
    if (participant.fighterKind === "human") this.humans.push(participant as HumanFighter);
    else this.bots.push(participant as BotFighter);
  }

  all(): readonly Participant[] {
    return this.members;
  }

  find(id: number): Participant | undefined {
    return this.members.find((member) => member.id === id);
  }

  require(id: number): Participant {
    const member = this.find(id);
    if (!member) throw new Error(`Fight participant ${id} is missing`);
    return member;
  }
}
