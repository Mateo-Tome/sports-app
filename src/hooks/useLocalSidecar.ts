// src/hooks/useLocalSidecar.ts
import * as FileSystem from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

import { assignIds, deriveOutcome, EventRow, normalizeEvents, Sidecar } from '../../components/playback/playbackCore';

type SidecarMeta = { sport?: string; style?: string; createdAt?: number };

function accumulate(evts: EventRow[]) {
  let h = 0,
    o = 0;
  return evts.map(e => {
    const pts = typeof e.points === 'number' ? e.points : 0;
    if (pts > 0) {
      if (e.actor === 'home') h += pts;
      else if (e.actor === 'opponent') o += pts;
    }
    return { ...e, scoreAfter: e.scoreAfter ?? { home: h, opponent: o } };
  });
}

export function useLocalSidecar(args: { videoPath: string; shareId?: string }) {
  const { videoPath, shareId } = args;

  const [events, setEvents] = useState<EventRow[]>([]);
  const [finalScore, setFinalScore] = useState<{ home: number; opponent: number } | undefined>(undefined);
  const [debugMsg, setDebugMsg] = useState('');
  const [athleteName, setAthleteName] = useState('Athlete');
  const [sport, setSport] = useState<string | undefined>(undefined);
  const [style, setStyle] = useState<string | undefined>(undefined);
  const [homeIsAthlete, setHomeIsAthlete] = useState(true);
  const [homeColorIsGreen, setHomeColorIsGreen] = useState(true);

  const sidecarPathRef = useRef<string | null>(null);
  const sidecarMeta = useRef<SidecarMeta>({});

  const saveSidecar = async (next: EventRow[]) => {
    try {
      const path = sidecarPathRef.current;
      if (!path) return;

      const ordered = [...next].sort((a, b) => a.t - b.t);
      const withScores = accumulate(ordered);
      const o = deriveOutcome(withScores, homeIsAthlete);
      setFinalScore(o.finalScore);

      const payload: Sidecar = {
        athlete: athleteName,
        sport: sidecarMeta.current.sport,
        style: sidecarMeta.current.style,
        createdAt: sidecarMeta.current.createdAt,
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
      };

      const tmp = `${path}.tmp`;
      await FileSystem.writeAsStringAsync(tmp, JSON.stringify(payload));
      try {
        DeviceEventEmitter.emit('sidecarUpdated', { uri: videoPath, sidecar: payload });
      } catch {}
      try {
        await FileSystem.deleteAsync(path, { idempotent: true });
      } catch {}
      await FileSystem.moveAsync({ from: tmp, to: path });
    } catch {}
  };

  useEffect(() => {
    if (!videoPath) {
      // cloud playback: no local sidecar
      if (shareId) {
        setDebugMsg('');
        setEvents([]);
        setFinalScore(undefined);
        sidecarPathRef.current = null;
        sidecarMeta.current = {};
        setSport(undefined);
        setStyle(undefined);
        setHomeIsAthlete(true);
        setHomeColorIsGreen(true);
        setAthleteName('Athlete');
        return;
      }

      setDebugMsg('No video path provided.');
      setEvents([]);
      setFinalScore(undefined);
      return;
    }

    const lastSlash = videoPath.lastIndexOf('/');
    const lastDot = videoPath.lastIndexOf('.');
    const base = lastDot > lastSlash ? videoPath.slice(0, lastDot) : videoPath;
    const guessSidecar = `${base}.json`;

    const tryReadSidecar = async (p: string) => {
      try {
        const info = await FileSystem.getInfoAsync(p);
        if (!(info as any)?.exists) return null;
        const txt = await FileSystem.readAsStringAsync(p);
        const parsed: Sidecar = JSON.parse(txt || '{}');
        return parsed;
      } catch {
        return null;
      }
    };

    const tryDirectorySearch = async () => {
      try {
        const dir = videoPath.slice(0, lastSlash + 1);
        // @ts-ignore
        const files: string[] = await (FileSystem as any).readDirectoryAsync(dir);
        const baseName = base.slice(lastSlash + 1);
        const candidate = files.find(f => f.toLowerCase() === `${baseName.toLowerCase()}.json`);
        if (!candidate) return null;
        return await tryReadSidecar(dir + candidate);
      } catch {
        return null;
      }
    };

    (async () => {
      setDebugMsg('Loading sidecar…');
      let usedPath: string | null = guessSidecar;

      let parsed = await tryReadSidecar(guessSidecar);
      if (!parsed) {
        parsed = await tryDirectorySearch();
        if (parsed) {
          usedPath = `${videoPath.slice(0, lastSlash + 1)}${base.slice(lastSlash + 1)}.json`;
        }
      }

      sidecarPathRef.current = usedPath;

      if (!parsed) {
        setEvents([]);
        setFinalScore(undefined);
        setDebugMsg(`No sidecar found. Looked for:\n${guessSidecar}`);
        sidecarMeta.current = {};
        setSport(undefined);
        setStyle(undefined);
        setHomeIsAthlete(true);
        setHomeColorIsGreen(true);
        setAthleteName('Athlete');
        return;
      }

      const hiA = parsed.homeIsAthlete !== false;
      const hcG = parsed.homeColorIsGreen !== false;

      setHomeIsAthlete(hiA);
      setHomeColorIsGreen(hcG);

      setAthleteName(parsed.athlete?.trim() || 'Athlete');
      sidecarMeta.current = { sport: parsed.sport, style: parsed.style, createdAt: parsed.createdAt };
      setSport(parsed.sport);
      setStyle(parsed.style);

      const rawEvts = Array.isArray(parsed.events) ? parsed.events : [];
      const normalized = normalizeEvents(rawEvts, hiA);
      const withIds = assignIds(normalized);
      const ordered = [...withIds].sort((a, b) => a.t - b.t);
      const withScores = accumulate(ordered);
      setEvents(withScores);

      const fs =
        parsed.finalScore ??
        (withScores.length ? withScores[withScores.length - 1].scoreAfter : { home: 0, opponent: 0 });
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
    homeIsAthlete,
    setHomeIsAthlete,
    homeColorIsGreen,
    setHomeColorIsGreen,
    saveSidecar,
    accumulate, // optional (handy if you want to reuse exactly)
  };
}
