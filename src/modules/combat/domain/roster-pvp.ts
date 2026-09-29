/**
 * A fight is PvP when every team has a human in it. Humans who died or left still count,
 * so the answer only changes when somebody joins.
 */
export function rosterIsPvp(humans: readonly Readonly<{ team: 1 | 2 }>[]): boolean {
  return humans.some((human) => human.team === 1) && humans.some((human) => human.team === 2);
}
