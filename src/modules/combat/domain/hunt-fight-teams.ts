export function huntFightOpenerTeam(purpose: "hunt" | "quest"): 1 | 2 {
  return purpose === "quest" ? 2 : 1;
}

export function huntFightEnemyTeam(purpose: "hunt" | "quest"): 1 | 2 {
  return purpose === "quest" ? 1 : 2;
}
