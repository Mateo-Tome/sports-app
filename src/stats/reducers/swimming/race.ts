import type { ClipSidecar, RecordedEvent } from '../../types';

function metaOf(e: RecordedEvent) {
  const meta: any = e?.meta ?? {};
  const inner: any = meta?.meta ?? {};
  return { ...inner, ...meta };
}

function num(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatTime(sec: number | null) {
  if (sec == null || !Number.isFinite(sec)) return '--';

  const m = Math.floor(sec / 60);
  const s = sec % 60;

  if (m <= 0) return s.toFixed(2);
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

function cleanRaceLabel(label: string) {
  const s = String(label ?? '').trim();
  const lower = s.toLowerCase();

  if (
    !s ||
    lower === 'swim' ||
    lower === 'swimming' ||
    lower === 'race' ||
    lower === 'swimming race' ||
    lower === 'no race selected'
  ) {
    return 'Swimming Race';
  }

  return s;
}

type RaceAgg = {
  raceLabel: string;
  clips: number;
  finished: number;
  bestTimeSec: number | null;
  latestTimeSec: number | null;
  totalTimeSec: number;
  totalSplits: number;
  splitCount: number;
  fastestSplitSec: number | null;
  slowestSplitSec: number | null;
  latestCreatedAt: number;
};

function emptyRace(label: string): RaceAgg {
  return {
    raceLabel: label,
    clips: 0,
    finished: 0,
    bestTimeSec: null,
    latestTimeSec: null,
    totalTimeSec: 0,
    totalSplits: 0,
    splitCount: 0,
    fastestSplitSec: null,
    slowestSplitSec: null,
    latestCreatedAt: 0,
  };
}

function raceLabelForClip(clip: ClipSidecar) {
  for (const e of clip.events ?? []) {
    const m = metaOf(e);
    if (m.raceLabel) return cleanRaceLabel(String(m.raceLabel));
  }

  return 'Swimming Race';
}

export function reduceSwimmingRace(clips: ClipSidecar[]) {
  const byRace: Record<string, RaceAgg> = {};

  let totalClips = 0;
  let totalEvents = 0;
  let finishedRaces = 0;

  for (const clip of clips ?? []) {
    totalClips += 1;
    totalEvents += Array.isArray(clip.events) ? clip.events.length : 0;

    const label = raceLabelForClip(clip);
    const key = label.toLowerCase();

    const agg = byRace[key] ?? emptyRace(label);
    byRace[key] = agg;

    agg.clips += 1;
    agg.latestCreatedAt = Math.max(
      agg.latestCreatedAt,
      Number(clip.createdAt ?? 0),
    );

    let finalTimeSec: number | null = null;

    for (const e of clip.events ?? []) {
      const kind = String(e.kind ?? e.key ?? '').toLowerCase();
      const m = metaOf(e);

      if (kind === 'turn_split') {
        const split = num(m.splitDurationSec);

        if (split != null) {
          agg.totalSplits += split;
          agg.splitCount += 1;

          if (agg.fastestSplitSec == null || split < agg.fastestSplitSec) {
            agg.fastestSplitSec = split;
          }

          if (agg.slowestSplitSec == null || split > agg.slowestSplitSec) {
            agg.slowestSplitSec = split;
          }
        }
      }

      if (kind === 'finish_race') {
        const finalTime = num(m.finalTimeSec);
        if (finalTime != null) {
          finalTimeSec = finalTime;
        }
      }
    }

    if (finalTimeSec != null) {
      finishedRaces += 1;
      agg.finished += 1;
      agg.totalTimeSec += finalTimeSec;

      if (agg.bestTimeSec == null || finalTimeSec < agg.bestTimeSec) {
        agg.bestTimeSec = finalTimeSec;
      }

      agg.latestTimeSec = finalTimeSec;
    }
  }

  const races = Object.values(byRace)
    .sort((a, b) => b.latestCreatedAt - a.latestCreatedAt)
    .map((r) => {
      const avgTimeSec = r.finished ? r.totalTimeSec / r.finished : null;
      const avgSplitSec = r.splitCount ? r.totalSplits / r.splitCount : null;

      const splitSpreadSec =
        r.fastestSplitSec != null && r.slowestSplitSec != null
          ? r.slowestSplitSec - r.fastestSplitSec
          : null;

      const latestVsBestSec =
        r.latestTimeSec != null && r.bestTimeSec != null
          ? r.latestTimeSec - r.bestTimeSec
          : null;

      return {
        raceLabel: r.raceLabel,
        clips: r.clips,
        finished: r.finished,

        bestTimeSec: r.bestTimeSec,
        bestTimeText: formatTime(r.bestTimeSec),

        latestTimeSec: r.latestTimeSec,
        latestTimeText: formatTime(r.latestTimeSec),

        avgTimeSec,
        avgTimeText: formatTime(avgTimeSec),

        avgSplitSec,
        avgSplitText: formatTime(avgSplitSec),

        fastestSplitSec: r.fastestSplitSec,
        fastestSplitText: formatTime(r.fastestSplitSec),

        slowestSplitSec: r.slowestSplitSec,
        slowestSplitText: formatTime(r.slowestSplitSec),

        splitSpreadSec,
        splitSpreadText: formatTime(splitSpreadSec),

        latestVsBestSec,
        latestVsBestText:
          latestVsBestSec == null
            ? '--'
            : latestVsBestSec === 0
              ? 'Matches best'
              : `${formatTime(Math.abs(latestVsBestSec))} off best`,
      };
    });

  return {
    sportKey: 'swimming:race',
    totals: {
      clips: totalClips,
      events: totalEvents,
      finishedRaces,
      raceTypes: races.length,
    },
    races,
  };
}