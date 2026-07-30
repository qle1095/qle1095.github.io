import {
  chapters,
  sideQuests,
  type Chapter,
  type Milestone,
  type Skill,
  type SideQuest,
} from '../data/journey';

// Converts the chronological journey data into horizontal world coordinates.
// Positions are proportional to time, with a minimum gap so clustered
// milestones never overlap.

const PX_PER_MONTH = 55;
const MIN_GAP = 520;
const START_PAD = 900; // walk-in space after the intro
const END_PAD = 1400; // room for the outro hand-off

const SKILL_SPACING = 150; // gap between skill pickups leading into a milestone
const SKILL_LEAD = 260; // distance before the milestone where pickups start

export type PlacedMilestone = Milestone & { x: number; chapterId: string };
export type PlacedSkill = Skill & { x: number; milestoneId: string };
export type PlacedChapter = {
  chapter: Chapter;
  startX: number;
  endX: number;
  startYear: number;
};
export type PlacedSideQuest = SideQuest & { x: number };

export type JourneyLayout = {
  worldWidth: number;
  milestones: PlacedMilestone[];
  skills: PlacedSkill[];
  chapters: PlacedChapter[];
  sideQuests: PlacedSideQuest[];
  yearMarkers: { year: number; x: number }[];
};

function monthIndex(date: string): number {
  const [y, m] = date.split('-').map(Number);
  return y * 12 + (m - 1);
}

export function buildLayout(): JourneyLayout {
  const all = chapters.flatMap((c) =>
    c.milestones.map((m) => ({ ...m, chapterId: c.id })),
  );
  all.sort((a, b) => monthIndex(a.date) - monthIndex(b.date));

  const originMonth = monthIndex(all[0].date);
  const milestones: PlacedMilestone[] = [];
  let prevX = -Infinity;
  for (const m of all) {
    let x = START_PAD + (monthIndex(m.date) - originMonth) * PX_PER_MONTH;
    if (x < prevX + MIN_GAP) x = prevX + MIN_GAP;
    prevX = x;
    milestones.push({ ...m, x });
  }

  const skills: PlacedSkill[] = milestones.flatMap((m) =>
    (m.skills ?? []).map((s, i, arr) => ({
      ...s,
      milestoneId: m.id,
      x: m.x - SKILL_LEAD - (arr.length - 1 - i) * SKILL_SPACING,
    })),
  );

  const worldWidth = prevX + END_PAD;

  const placedChapters: PlacedChapter[] = chapters.map((chapter, ci) => {
    const first = milestones.find((m) => m.chapterId === chapter.id)!;
    const nextChapter = chapters[ci + 1];
    const nextFirst = nextChapter
      ? milestones.find((m) => m.chapterId === nextChapter.id)!
      : null;
    // A chapter's territory runs from just before its first milestone to just
    // before the next chapter's first milestone.
    const startX = ci === 0 ? 0 : first.x - MIN_GAP / 2;
    const endX = nextFirst ? nextFirst.x - MIN_GAP / 2 : worldWidth;
    return {
      chapter,
      startX,
      endX,
      startYear: Number(first.date.slice(0, 4)),
    };
  });

  const xForMonth = (mi: number) => {
    // Interpolate between surrounding milestones so gap-compression is respected.
    const before = [...milestones].reverse().find((m) => monthIndex(m.date) <= mi);
    const after = milestones.find((m) => monthIndex(m.date) >= mi);
    if (!before) return START_PAD;
    if (!after || before === after) return before.x;
    const t =
      (mi - monthIndex(before.date)) /
      (monthIndex(after.date) - monthIndex(before.date));
    return before.x + t * (after.x - before.x);
  };

  const placedSideQuests: PlacedSideQuest[] = sideQuests.map((q) => ({
    ...q,
    x: xForMonth(monthIndex(q.date)),
  }));

  const firstYear = Number(all[0].date.slice(0, 4));
  const lastYear = Number(all[all.length - 1].date.slice(0, 4));
  const yearMarkers: { year: number; x: number }[] = [];
  for (let y = firstYear; y <= lastYear; y++) {
    yearMarkers.push({ year: y, x: xForMonth(y * 12) });
  }

  return {
    worldWidth,
    milestones,
    skills,
    chapters: placedChapters,
    sideQuests: placedSideQuests,
    yearMarkers,
  };
}
