import type { ContentBundle } from "../domain/content-document.ts";

export function collectBattlegroundIssues(bundle: ContentBundle): readonly string[] {
  const issues: string[] = [];
  const areaIds = new Set(bundle.areas.map((area) => area.id));
  const keys = new Set<string>();
  let playable = 0;
  for (const card of bundle.battlegrounds) {
    const key = `${card.type}|${card.id}`;
    if (keys.has(key)) issues.push(`battleground ${key} is duplicated`);
    keys.add(key);
    if (card.playable === 1) {
      playable += 1;
      if (card.available !== 1) issues.push(`playable battleground ${key} must be available`);
      if (!card.queueLevel) issues.push(`playable battleground ${key} queueLevel is required`);
      if (card.levelMin < 1 || card.levelMax < card.levelMin) {
        issues.push(`playable battleground ${key} level range is invalid`);
      }
      if (card.inviteTtlSec < 1 || card.banSec < 1 || card.matchDurationSec < 1) {
        issues.push(`playable battleground ${key} timers are invalid`);
      }
      if (card.maxScore < 1 || card.pointsPerKill < 1) {
        issues.push(`playable battleground ${key} score is invalid`);
      }
      if (card.instArtikulId < 1)
        issues.push(`playable battleground ${key} instArtikulId is required`);
      for (const areaId of [
        card.returnAreaId,
        card.westAreaId,
        card.arenaAreaId,
        card.eastAreaId,
      ]) {
        if (!areaIds.has(areaId)) {
          issues.push(`playable battleground ${key} area ${areaId} is missing`);
        }
      }
      const rooms = new Set(card.roomPos.map((room) => room.areaId));
      if (
        !rooms.has(card.westAreaId) ||
        !rooms.has(card.arenaAreaId) ||
        !rooms.has(card.eastAreaId)
      ) {
        issues.push(`playable battleground ${key} roomPos must cover west/arena/east`);
      }
      for (const areaId of [card.westAreaId, card.arenaAreaId, card.eastAreaId]) {
        const area = bundle.areas.find((row) => row.id === areaId);
        if (area && area.bgId !== String(card.id)) {
          issues.push(`area ${areaId} bgId must be ${card.id}`);
        }
      }
      if (card.leaderGroups.length < 1) {
        issues.push(`playable battleground ${key} leaderGroups are required`);
      }
      for (const kind of [2, 3]) {
        if (!bundle.appearances.some((row) => row.kind === kind && row.gender === 1)) {
          issues.push(`playable battleground ${key} needs appearance kind ${kind} gender 1`);
        }
      }
    } else if (card.available === 1) {
      issues.push(`unplayable battleground ${key} cannot be available`);
    }
  }
  if (playable !== 1) issues.push(`expected one playable battleground, found ${playable}`);
  return issues;
}
