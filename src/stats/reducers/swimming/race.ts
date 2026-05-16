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

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function formatTime(sec: number | null) {
  if (sec == null || !Number.isFinite(sec)) return '--';

  const m = Math.floor(sec / 60);
  const s = sec % 60;

  if (m <= 0) return s.toFixed(2);
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
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
  totalStrokes: number;
  strokeClipCount: number;
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
    totalStrokes: 0,
    strokeClipCount: 0,
    latestCreatedAt: 0,
  };
}

function raceLabelForClip(clip: ClipSidecar) {
  for (const e of clip.events ?? []) {
    const m = metaOf(e);
    if (m.raceLabel) return String(m.raceLabel);
  }

  const sport = String(clip.sport ?? '').trim();
  const style = String(clip.style ?? '').trim();

  if (sport && style && style !== 'race' && style !== 'default') return `${sport} ${style}`;
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
    agg.latestCreatedAt = Math.max(agg.latestCreatedAt, Number(clip.createdAt ?? 0));

    let finalTimeSec: number | null = null;
    let maxStrokeCount = 0;

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
        }
      }

      if (kind === 'stroke_count') {
        const strokes = num(m.strokeCount);
        if (strokes != null) {
          maxStrokeCount = Math.max(maxStrokeCount, strokes);
        }
      }

      if (kind === 'finish_race') {
        const finalTime = num(m.finalTimeSec);
        if (finalTime != null) {
          finalTimeSec = finalTime;
        }

        const finishStrokes = num(m.strokeCount);
        if (finishStrokes != null) {
          maxStrokeCount = Math.max(maxStrokeCount, finishStrokes);
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

    if (maxStrokeCount > 0) {
      agg.totalStrokes += maxStrokeCount;
      agg.strokeClipCount += 1;
    }
  }

  const races = Object.values(byRace)
    .sort((a, b) => b.latestCreatedAt - a.latestCreatedAt)
    .map((r) => {
      const avgTimeSec = r.finished ? r.totalTimeSec / r.finished : null;
      const avgSplitSec = r.splitCount ? r.totalSplits / r.splitCount : null;
      const avgStrokes = r.strokeClipCount ? r.totalStrokes / r.strokeClipCount : null;

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

        avgStrokes,
        avgStrokesText: avgStrokes == null ? '--' : String(round2(avgStrokes)),
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