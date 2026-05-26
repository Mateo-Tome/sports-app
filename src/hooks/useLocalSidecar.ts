import * as FileSystem from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

import {
  assignIds,
  deriveOutcome,
  EventRow,
  normalizeEvents,
  Sidecar,
} from '../../components/playback/playbackCore';

type OrientationOverride = 0 | 90 | 180 | 270;

type SidecarMeta = {
  athlete?: string | null;
  athleteName?: string | null;
  athleteId?: string | null;

  sport?: string;
  style?: string;
  createdAt?: number;
  orientationOverride?: OrientationOverride;

  raceLabel?: string | null;
  stroke?: string | null;
  distance?: string | null;
};

type SidecarWithOrientation = Sidecar & {
  athleteName?: string | null;
  athleteId?: string | null;

  orientationOverride?: OrientationOverride;

  raceLabel?: string | null;
  stroke?: string | null;
  distance?: string | null;
};

function cleanString(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

function accumulate(evts: EventRow[]) {
  let h = 0;
  let o = 0;

  return evts.map((e) => {
    const pts = typeof e.points === 'number' ? e.points : 0;

    if (pts > 0) {
      if (e.actor === 'home') h += pts;
      else if (e.actor === 'opponent') o += pts;
    }

    return {
      ...e,
      scoreAfter: {
        home: h,
        opponent: o,
      },
    };
  });
}

function normalizeOrientationOverride(value: unknown): OrientationOverride {
  return value === 90 || value === 180 || value === 270 ? value : 0;
}

function parseSportStyleFromVideoPath(videoPath: string): {
  sport?: string;
  style?: string;
} {
  const parts = String(videoPath).split('/').filter(Boolean);
  const folder = parts.length >= 2 ? parts[parts.length - 2] : '';
  const raw = String(folder || '').trim();

  if (!raw) return {};

  const name = raw.toLowerCase();
  const seps = ['-', '_', ':'] as const;

  let bestSep: (typeof seps)[number] | null = null;
  let bestIdx = -1;

  for (const sep of seps) {
    const idx = name.lastIndexOf(sep);

    if (idx > 0 && idx < name.length - 1 && idx > bestIdx) {
      bestIdx = idx;
      bestSep = sep;
    }
  }

  if (bestIdx === -1 || !bestSep) {
    const sport = name.trim();
    return sport ? { sport, style: 'default' } : {};
  }

  const sport = name.slice(0, bestIdx).trim();
  const style = name.slice(bestIdx + 1).trim();

  return {
    sport: sport || undefined,
    style: style || 'default',
  };
}

async function resolveSidecarPath(videoPath: string): Promise<string> {
  const lastSlash = videoPath.lastIndexOf('/');
  const lastDot = videoPath.lastIndexOf('.');
  const base = lastDot > lastSlash ? videoPath.slice(0, lastDot) : videoPath;
  const guess = `${base}.json`;

  try {
    const info = await FileSystem.getInfoAsync(guess);
    if ((info as any)?.exists) return guess;
  } catch {}

  const dir = videoPath.slice(0, lastSlash + 1);
  const baseName = base.slice(lastSlash + 1);

  try {
    // @ts-ignore
    const files: string[] = await (FileSystem as any).readDirectoryAsync(dir);
    const candidate = files.find(
      (f) => f.toLowerCase() === `${baseName.toLowerCase()}.json`,
    );

    if (candidate) return dir + candidate;
  } catch {}

  return guess;
}

async function tryReadSidecarAt(path: string): Promise<SidecarWithOrientation | null> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!(info as any)?.exists) return null;

    const txt = await FileSystem.readAsStringAsync(path);
    return JSON.parse(txt || '{}') as SidecarWithOrientation;
  } catch {
    return null;
  }
}

function ensureEventIds(input: any[]): EventRow[] {
  return (input || []).map((e: any) => {
    const existing = e?._id ?? e?.id;

    const _id =
      typeof existing === 'string' && existing.trim().length > 0
        ? existing.trim()
        : Math.random().toString(36).slice(2, 9);

    return {
      ...(e as any),
      _id,
    } as EventRow;
  });
}

export function useLocalSidecar(args: {
  videoPath: string;
  shareId?: string;
}) {
  const { videoPath, shareId } = args;

  const [events, setEvents] = useState<EventRow[]>([]);

  const [finalScore, setFinalScore] = useState<
    { home: number; opponent: number } | undefined
  >(undefined);

  const [debugMsg, setDebugMsg] = useState('');
  const [athleteName, setAthleteName] = useState('Athlete');

  const [sport, setSport] = useState<string | undefined>(undefined);
  const [style, setStyle] = useState<string | undefined>(undefined);

  const [raceLabel, setRaceLabel] = useState<string | null>(null);
  const [stroke, setStroke] = useState<string | null>(null);
  const [distance, setDistance] = useState<string | null>(null);

  const [homeIsAthlete, setHomeIsAthlete] = useState(true);
  const [homeColorIsGreen, setHomeColorIsGreen] = useState(true);

  const [orientationOverride, setOrientationOverride] =
    useState<OrientationOverride>(0);

  const sidecarPathRef = useRef<string | null>(null);
  const sidecarMeta = useRef<SidecarMeta>({});

  const writeSidecar = async (
    nextEvents: EventRow[],
    overrideArg?: OrientationOverride,
  ) => {
    try {
      const path = sidecarPathRef.current;
      if (!path) return;

      const ordered = [...nextEvents].sort((a, b) => a.t - b.t);
      const withScores = accumulate(ordered);

      const o = deriveOutcome(withScores, homeIsAthlete);
      setFinalScore(o.finalScore);

      const pathGuess = videoPath ? parseSportStyleFromVideoPath(videoPath) : {};

      const finalAthleteName =
        cleanString(athleteName) ||
        cleanString(sidecarMeta.current.athleteName) ||
        cleanString(sidecarMeta.current.athlete) ||
        'Athlete';

      const finalAthleteId = cleanString(sidecarMeta.current.athleteId);

      const finalSport =
        (sport ?? '').trim() ||
        (sidecarMeta.current.sport ?? '').trim() ||
        (pathGuess.sport ?? '').trim() ||
        'unknown';

      const finalStyle =
        (style ?? '').trim() ||
        (sidecarMeta.current.style ?? '').trim() ||
        (pathGuess.style ?? '').trim() ||
        'default';

      const finalRaceLabel =
        sidecarMeta.current.raceLabel ?? raceLabel ?? null;

      const finalStroke =
        sidecarMeta.current.stroke ?? stroke ?? null;

      const finalDistance =
        sidecarMeta.current.distance ?? distance ?? null;

      const finalOrientationOverride = normalizeOrientationOverride(
        overrideArg ??
          sidecarMeta.current.orientationOverride ??
          orientationOverride,
      );

      const payload: SidecarWithOrientation = {
        athlete: finalAthleteName,
        athleteName: finalAthleteName,
        athleteId: finalAthleteId,

        sport: finalSport,
        style: finalStyle,

        raceLabel: finalRaceLabel,
        stroke: finalStroke,
        distance: finalDistance,

        createdAt: sidecarMeta.current.createdAt ?? Date.now(),

        events: withScores,
        finalScore: o.finalScore,

        homeIsAthlete,
        homeColorIsGreen,

        appVersion: 1,

        outcome: o.outcome,
        winner: o.winner,
        endedBy: o.endedBy,
        athletePinned: o.athletePinned,
        athleteWasPinned: o.athleteWasPinned,

        modifiedAt: Date.now(),
        orientationOverride: finalOrientationOverride,
      };

      const tmp = `${path}.tmp`;
      await FileSystem.writeAsStringAsync(tmp, JSON.stringify(payload, null, 2));

      try {
        await FileSystem.deleteAsync(path, {
          idempotent: true,
        });
      } catch {}

      await FileSystem.moveAsync({
        from: tmp,
        to: path,
      });

      sidecarMeta.current = {
        ...sidecarMeta.current,
        athlete: finalAthleteName,
        athleteName: finalAthleteName,
        athleteId: finalAthleteId,

        sport: finalSport,
        style: finalStyle,
        raceLabel: finalRaceLabel,
        stroke: finalStroke,
        distance: finalDistance,
        orientationOverride: finalOrientationOverride,
      };

      setAthleteName(finalAthleteName);
      setRaceLabel(finalRaceLabel);
      setStroke(finalStroke);
      setDistance(finalDistance);
      setOrientationOverride(finalOrientationOverride);

      try {
        DeviceEventEmitter.emit('sidecarUpdated', {
          uri: videoPath,
          sidecar: payload,
        });
      } catch {}
    } catch {}
  };

  const saveSidecar = async (next: EventRow[]) => {
    await writeSidecar(next);
  };

  const persistOrientationOverride = async (
    nextOverride: OrientationOverride,
    nextEvents?: EventRow[],
  ) => {
    const normalized = normalizeOrientationOverride(nextOverride);

    sidecarMeta.current.orientationOverride = normalized;
    setOrientationOverride(normalized);

    await writeSidecar(nextEvents ?? events, normalized);
  };

  useEffect(() => {
    if (!videoPath) {
      if (shareId) {
        setDebugMsg('');
        setEvents([]);
        setFinalScore(undefined);

        sidecarPathRef.current = null;
        sidecarMeta.current = {};

        setSport(undefined);
        setStyle(undefined);

        setRaceLabel(null);
        setStroke(null);
        setDistance(null);

        setHomeIsAthlete(true);
        setHomeColorIsGreen(true);
        setAthleteName('Athlete');
        setOrientationOverride(0);

        return;
      }

      setDebugMsg('No video path provided.');
      setEvents([]);
      setFinalScore(undefined);

      setRaceLabel(null);
      setStroke(null);
      setDistance(null);

      setOrientationOverride(0);

      return;
    }

    (async () => {
      setDebugMsg('Loading sidecar…');

      const resolvedPath = await resolveSidecarPath(videoPath);
      sidecarPathRef.current = resolvedPath;

      const parsed = await tryReadSidecarAt(resolvedPath);
      const fromPath = parseSportStyleFromVideoPath(videoPath);

      if (!parsed) {
        setEvents([]);
        setFinalScore(undefined);

        setDebugMsg(`No sidecar found. Will create on save.\n${resolvedPath}`);

        sidecarMeta.current = {
          athlete: 'Athlete',
          athleteName: 'Athlete',
          athleteId: null,

          sport: fromPath.sport,
          style: fromPath.style,
          createdAt: Date.now(),
          orientationOverride: 0,
          raceLabel: null,
          stroke: null,
          distance: null,
        };

        setSport(fromPath.sport);
        setStyle(fromPath.style);

        setRaceLabel(null);
        setStroke(null);
        setDistance(null);

        setHomeIsAthlete(true);
        setHomeColorIsGreen(true);
        setAthleteName('Athlete');
        setOrientationOverride(0);

        return;
      }

      const hiA = parsed.homeIsAthlete !== false;
      const hcG = parsed.homeColorIsGreen !== false;

      const parsedOrientationOverride = normalizeOrientationOverride(
        parsed.orientationOverride,
      );

      setHomeIsAthlete(hiA);
      setHomeColorIsGreen(hcG);
      setOrientationOverride(parsedOrientationOverride);

      const parsedAthleteName =
        cleanString((parsed as any).athleteName) ||
        cleanString(parsed.athlete) ||
        'Athlete';

      const parsedAthleteId = cleanString((parsed as any).athleteId);

      setAthleteName(parsedAthleteName);

      const parsedSport =
        String(parsed.sport ?? '').trim() || fromPath.sport || 'unknown';

      const parsedStyle =
        String(parsed.style ?? '').trim() || fromPath.style || 'default';

      const parsedRaceLabel = cleanString((parsed as any).raceLabel);
      const parsedStroke = cleanString((parsed as any).stroke);
      const parsedDistance = cleanString((parsed as any).distance);

      sidecarMeta.current = {
        athlete: parsedAthleteName,
        athleteName: parsedAthleteName,
        athleteId: parsedAthleteId,

        sport: parsedSport,
        style: parsedStyle,
        createdAt: parsed.createdAt ?? Date.now(),
        orientationOverride: parsedOrientationOverride,

        raceLabel: parsedRaceLabel,
        stroke: parsedStroke,
        distance: parsedDistance,
      };

      setSport(parsedSport);
      setStyle(parsedStyle);

      setRaceLabel(parsedRaceLabel);
      setStroke(parsedStroke);
      setDistance(parsedDistance);

      const rawEvts = Array.isArray(parsed.events) ? parsed.events : [];
      const normalized = normalizeEvents(rawEvts, hiA);

      const withIds = ensureEventIds(assignIds(normalized) as any);

      const ordered = [...withIds].sort((a, b) => a.t - b.t);
      const withScores = accumulate(ordered);

      setEvents(withScores);

      const fs =
        withScores.length
          ? withScores[withScores.length - 1].scoreAfter
          : parsed.finalScore ?? {
              home: 0,
              opponent: 0,
            };

      setFinalScore(fs);

      setDebugMsg(withScores.length ? '' : 'Sidecar loaded but no events.');
    })();
  }, [videoPath, shareId]);

  return {
    events,
    setEvents,

    finalScore,
    setFinalScore,

    debugMsg,

    athleteName,
    setAthleteName,

    sport,
    style,

    raceLabel,
    stroke,
    distance,

    homeIsAthlete,
    setHomeIsAthlete,

    homeColorIsGreen,
    setHomeColorIsGreen,

    orientationOverride,
    setOrientationOverride,

    saveSidecar,
    persistOrientationOverride,

    accumulate,
  };
}