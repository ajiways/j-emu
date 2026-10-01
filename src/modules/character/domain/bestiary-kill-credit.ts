export function bestiaryCreditHeroIds(
  input: Readonly<{
    kind: "win" | "loss" | "last-leave";
    topCharacterId: number | null;
    humanIds: readonly number[];
    partyMemberIds: ReadonlySet<number> | null;
  }>,
): readonly number[] {
  if (input.kind !== "win") return [];
  const topId = input.topCharacterId;
  // A mob of the heroes' own side did the most: nobody is credited with the kill.
  if (topId === null) return [];
  if (!input.humanIds.includes(topId)) {
    throw new Error(`Hunt win top damager ${topId} is missing from the fight`);
  }
  if (input.partyMemberIds?.has(topId)) {
    const party = input.partyMemberIds;
    return input.humanIds.filter((id) => party.has(id));
  }
  return [topId];
}
