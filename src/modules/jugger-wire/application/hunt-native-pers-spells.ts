/** Live native melee pack for hunt bootstrap (`jgr-emu` `buildPersSpellsEvent` without pocket/glove). */
export function huntNativePersSpells(aggroCount: number): Readonly<Record<string, unknown>> {
  if (!Number.isInteger(aggroCount) || aggroCount < 0) {
    throw new Error("Hunt aggro count must be a non-negative integer");
  }
  const spells: readonly Readonly<Record<string, unknown>>[] = [
    {
      pack: 1,
      persRestr: { active: true, dead: false },
      srcId: 1,
      srcType: 1,
      targetRestr: { dead: false, opp: true },
      title: "Удар слева",
    },
    {
      pack: 1,
      persRestr: { active: true, dead: false },
      srcId: 2,
      srcType: 1,
      targetRestr: { dead: false, opp: true },
      title: "Удар прямо",
    },
    {
      pack: 1,
      persRestr: { active: true, dead: false },
      srcId: 3,
      srcType: 1,
      targetRestr: { dead: false, opp: true },
      title: "Удар справа",
    },
    {
      artikulId: 212,
      flags: "0",
      groupId: 844,
      img: "rageeffect_2702.png",
      persRestr: { dead: false },
      srcId: 6,
      srcType: 1,
      targetRestr: { dead: false, groupdeny: true, self: true },
      title: "Ярость",
    },
    {
      artikulId: 487,
      cooldown: 90,
      flags: "0",
      img: "rageeffect_2702.png",
      persRestr: { dead: false, noopp: true },
      srcId: 5,
      srcType: 1,
      targetRestr: { dead: false },
      title: "Удар в спину",
    },
    {
      count: aggroCount,
      persRestr: { dead: false },
      srcId: 7,
      srcType: 1,
      targetRestr: { dead: false, oppTeam: true },
      title: "Разозлить",
    },
  ];
  const ev: Record<string, unknown> = { et: "persSpells" };
  spells.forEach((spell, index) => {
    ev[String(index + 1)] = spell;
  });
  return ev;
}
