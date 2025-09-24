// app/screens/PlaybackScreen.tsx
import * as FileSystem from 'expo-file-system';
import { useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

type EventRow = {
  t: number;               // seconds from start
  kind: string;            // 'takedown', 'nearfall', etc.
  points?: number;
  actor?: 'home' | 'opponent' | 'neutral';
  meta?: any;
};

export default function PlaybackScreen() {
  const { videoPath: rawVideoPath } = useLocalSearchParams();
  const videoPath = Array.isArray(rawVideoPath) ? rawVideoPath[0] : (rawVideoPath || '');

  const [events, setEvents] = useState<EventRow[]>([]);
  const [debugMsg, setDebugMsg] = useState<string>('');
  const [sidecarPath, setSidecarPath] = useState<string>('');

  // Create a player with a harmless initial source (empty string),
  // then replace it when we actually have a file path.
  const player = useVideoPlayer('', (p) => {
    p.loop = false;
    // don't autoplay; user can use native controls
  });

  // When the videoPath changes, replace the player's source
  useEffect(() => {
    if (videoPath) {
      try {
        // for expo-video, a local file URI string is a valid VideoSource
        player.replace(String(videoPath));
      } catch (e) {}
    }
  }, [videoPath, player]);

  // Pretty mm:ss
  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  // Load sidecar JSON sitting next to the mp4
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
        const parsed = JSON.parse(txt || '{}');
        const evts: EventRow[] = Array.isArray(parsed?.events) ? parsed.events : [];
        return { p, evts };
      } catch {
        return null;
      }
    };

    const tryDirectorySearch = async () => {
      try {
        const dir = videoPath.slice(0, lastSlash + 1);
        // @ts-ignore: present on expo-file-system in Expo
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
      let hit = await tryReadSidecar(guessSidecar);
      if (!hit) hit = await tryDirectorySearch();

      if (!hit) {
        setSidecarPath(guessSidecar);
        setEvents([]);
        setDebugMsg(`No sidecar found. Looked for:\n${guessSidecar}`);
        return;
      }

      setSidecarPath(hit.p);
      setEvents(hit.evts ?? []);
      setDebugMsg(hit.evts?.length ? '' : `Sidecar loaded but no events in: ${hit.p}`);
    })();
  }, [videoPath]);

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <View style={{ padding: 16 }}>
        {videoPath ? (
          <VideoView
            player={player}
            style={{ width: '100%', height: 240, backgroundColor: '#111', borderRadius: 8 }}
            allowsFullscreen
            allowsPictureInPicture
            // nativeControls is true by default on iOS; add explicitly if needed:
            nativeControls
            contentFit="contain"
          />
        ) : (
          <Text style={{ color: 'white' }}>No video path provided.</Text>
        )}
      </View>

      {/* Events List (tap to seek) */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      >
        <Text style={{ color: 'white', fontWeight: '800', marginBottom: 8 }}>
          Events {events.length ? `(${events.length})` : ''}
        </Text>

        {events.length === 0 ? (
          <Text style={{ color: 'white', opacity: 0.7 }}>
            {debugMsg || 'No events found for this recording.'}
            {sidecarPath ? `\nSidecar: ${sidecarPath}` : ''}
          </Text>
        ) : (
          events
            .slice()
            .sort((a, b) => a.t - b.t)
            .map((e, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  try {
                    // expo-video seek: set seconds directly
                    player.currentTime = Math.max(0, Math.floor(e.t));
                  } catch {}
                }}
                style={{
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <Text style={{ color: 'white' }}>
                  {fmt(e.t)}  {e.kind?.toUpperCase?.() || 'EVENT'}  {e.points ? `+${e.points} ` : ''}
                  {e.actor ? `(${e.actor === 'home' ? 'Home' : e.actor === 'opponent' ? 'Opp' : e.actor})` : ''}
                </Text>
              </TouchableOpacity>
            ))
        )}
      </ScrollView>
    </View>
  );
}
