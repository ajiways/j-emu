/** Live native melee pack for hunt bootstrap (`jgr-emu` `buildPersSpellsEvent` without pocket/glove). */
export function huntNativePersSpells(): Readonly<Record<string, unknown>> {
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
      count: 1,
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
