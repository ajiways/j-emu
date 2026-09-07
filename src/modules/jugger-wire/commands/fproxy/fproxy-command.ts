import type { FightCommand } from "../../../combat/ports/combat-port.ts";

export interface FproxyCommand {
  readonly key: string;
  decode(frame: unknown): FightCommand;
}
