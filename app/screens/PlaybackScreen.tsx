// app/screens/PlaybackScreen.tsx
import * as FileSystem from 'expo-file-system';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

type EventRow = {
  t: number;
  kind: string;
  points?: number;
  actor?: 'home' | 'opponent' | 'neutral';
  meta?: any;
  scoreAfter?: { home: number; opponent: number };
};

type Sidecar = {
  athlete?: string;
  sport?: string;
  style?: string;
  createdAt?: number;
  events?: EventRow[];
  finalScore?: { home: number; opponent: number };
  homeIsAthlete?: boolean;
  appVersion?: number;
};

export default function PlaybackScreen() {
  const { videoPath: rawVideoPath } = useLocalSearchParams();
  const videoPath = Array.isArray(rawVideoPath) ? rawVideoPath[0] : (rawVideoPath || '');

  const [events, setEvents] = useState<EventRow[]>([]);
  const [debugMsg, setDebugMsg] = useState<string>('');
  const [sidecarPath, setSidecarPath] = useState<string>('');
  const [finalScore, setFinalScore] = useState<{ home: number; opponent: number } | null>(null);
  const [homeIsAthlete, setHomeIsAthlete] = useState<boolean>(true);

  const player = useVideoPlayer('', (p) => { p.loop = false; });
  useEffect(() => { if (videoPath) { try { player.replace(String(videoPath)); } catch {} } }, [videoPath, player]);

  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  // Score accumulation fallback (in case older sidecars lack scoreAfter/finalScore)
  const accumulate = (evts: EventRow[]) => {
    let h = 0, o = 0;
    return evts.map(e => {
      const pts = typeof e.points === 'number' ? e.points : 0;
      if (pts > 0) {
        if (e.actor === 'home') h += pts;
        else if (e.actor === 'opponent') o += pts;
      }
      return { ...e, scoreAfter: e.scoreAfter ?? { home: h, opponent: o } };
    });
  };

  useEffect(() => {
    if (!videoPath) {
      setDebugMsg('No video path provided.');
      setEvents([]);
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

      let parsed = await tryReadSidecar(guessSidecar);
      if (!parsed) parsed = await tryDirectorySearch();

      if (!parsed) {
        setSidecarPath(guessSidecar);
        setEvents([]);
        setFinalScore(null);
        setDebugMsg(`No sidecar found. Looked for:\n${guessSidecar}`);
        return;
      }

      setSidecarPath(guessSidecar);
      setHomeIsAthlete(parsed.homeIsAthlete !== false); // default true
      const evts = Array.isArray(parsed.events) ? parsed.events : [];
      const ordered = [...evts].sort((a, b) => a.t - b.t);
      const withScores = accumulate(ordered);
      setEvents(withScores);

      const fs = parsed.finalScore ?? (withScores.length
        ? withScores[withScores.length - 1].scoreAfter ?? null
        : null);
      setFinalScore(fs ?? null);
      setDebugMsg(withScores.length ? '' : 'Sidecar loaded but no events.');
    })();
  }, [videoPath]);

  const outcomeChip = useMemo(() => {
    if (!finalScore) return null;
    const a = homeIsAthlete ? finalScore.home : finalScore.opponent;
    const b = homeIsAthlete ? finalScore.opponent : finalScore.home;
    const out = a > b ? 'W' : a < b ? 'L' : 'T';
    const color = out === 'W' ? '#16a34a' : out === 'L' ? '#dc2626' : '#f59e0b';
    return { out, a, b, color };
  }, [finalScore, homeIsAthlete]);

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <View style={{ padding: 16 }}>
        <VideoView
          player={player}
          style={{ width: '100%', height: 240, backgroundColor: '#111', borderRadius: 8 }}
          allowsFullscreen
          allowsPictureInPicture
          nativeControls
          contentFit="contain"
        />
        {outcomeChip && (
          <View style={{ marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: `${outcomeChip.color}22`, borderWidth: 1, borderColor: `${outcomeChip.color}66` }}>
            <Text style={{ color: 'white', fontWeight: '900' }}>
              {outcomeChip.out} {outcomeChip.a}–{outcomeChip.b}
            </Text>
          </View>
        )}
      </View>

      {/* Events List (tap to seek) */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text style={{ color: 'white', fontWeight: '800', marginBottom: 8 }}>
          Events {events.length ? `(${events.length})` : ''}
        </Text>

        {events.length === 0 ? (
          <Text style={{ color: 'white', opacity: 0.7 }}>
            {debugMsg || 'No events found for this recording.'}
            {sidecarPath ? `\nSidecar: ${sidecarPath}` : ''}
          </Text>
        ) : (
          events.map((e, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => { try { player.currentTime = Math.max(0, Math.floor(e.t)); } catch {} }}
              style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}
            >
              <Text style={{ color: 'white' }}>
                {fmt(e.t)}  {e.kind?.toUpperCase?.() || 'EVENT'}  {e.points ? `+${e.points} ` : ''}
                {e.actor ? `(${e.actor === 'home' ? 'Home' : 'Opp'})` : ''}
                {e.scoreAfter ? `   •   Score ${e.scoreAfter.home}–${e.scoreAfter.opponent}` : ''}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

