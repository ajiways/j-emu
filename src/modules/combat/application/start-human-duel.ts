import { requireWireIdentity } from "../../../shared/kernel/decimal-id.ts";
import { randomBytes } from "node:crypto";
import { Battle } from "../domain/battle.ts";
import { fightStartOf } from "./fight-start-of.ts";
import type { BattleRules } from "../domain/battle-rules.ts";
import { FightRules } from "../domain/fight-rules.ts";
import type { RandomSource } from "../domain/random-source.ts";
import type { FightStart, FriendlyDuelStartInput } from "../ports/combat-port.ts";
import type { CombatDiagnostics } from "../ports/combat-diagnostics.ts";
import { reportUnsupportedSkills } from "./report-unsupported-skills.ts";
import { fightSetupFromHumanDuel } from "./fight-setup-from-human-duel.ts";

export function startHumanDuelBattle(
  input: FriendlyDuelStartInput,
  kind: "friendly-duel" | "pvp",
  deps: Readonly<{
    byAccount: Map<number, Battle>;
    battleByFight: Map<string, Battle>;
    rules: BattleRules;
    random: RandomSource;
    openingRandom: RandomSource;
    now: Date;
    diagnostics: CombatDiagnostics;
    requireFightId: (fightId: string) => string;
  }>,
): FightStart {
  requireWireIdentity(input.challenger.accountId, "challenger account id");
  requireWireIdentity(input.acceptor.accountId, "acceptor account id");
  requireWireIdentity(input.challenger.heroId, "challenger hero id");
  requireWireIdentity(input.acceptor.heroId, "acceptor hero id");
  if (deps.byAccount.has(input.challenger.accountId)) {
    throw new Error("Challenger already has an active fight");
  }
  if (deps.byAccount.has(input.acceptor.accountId)) {
    throw new Error("Acceptor already has an active fight");
  }
  const fightId = deps.requireFightId(input.fightId);
  if (deps.battleByFight.has(fightId)) throw new Error(`Fight ${fightId} is already active`);
  const accessKey = randomBytes(16).toString("hex");
  const fightRules = humanDuelFightRules(kind);
  const battle = new Battle(
    fightSetupFromHumanDuel(input, accessKey, deps.now, kind, fightRules.teamAssignment),
    deps.rules,
    fightRules,
    deps.random,
    deps.openingRandom,
  );
  deps.byAccount.set(input.challenger.accountId, battle);
  deps.byAccount.set(input.acceptor.accountId, battle);
  deps.battleByFight.set(fightId, battle);
  reportUnsupportedSkills(deps.diagnostics, fightId, {
    humans: battle.boardParticipants().humans,
    bots: [],
  });
  return fightStartOf(battle, input.acceptor.heroId);
}

function humanDuelFightRules(kind: "friendly-duel" | "pvp"): FightRules {
  if (kind === "friendly-duel") return FightRules.for({ kind: "friendly-duel" });
  if (kind === "pvp") return FightRules.for({ kind: "pvp" });
  throw new Error(`Unknown human duel kind: ${String(kind)}`);
}
