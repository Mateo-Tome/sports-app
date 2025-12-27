// src/hooks/useShareSidecar.ts
import { useEffect, useState } from 'react';
import type { Actor, EventRow } from '../../components/playback/playbackCore';
import { toActor } from '../../components/playback/playbackCore';

export type ShareMeta = {
  sport?: string;
  style?: string;
  athleteName?: string;
  homeIsAthlete?: boolean;
  homeColorIsGreen?: boolean;
  finalScore?: { home: number; opponent: number };
};

type Args = {
  shareId?: string;
  sidecarUrl?: string;
  accumulateEvents: (events: EventRow[]) => EventRow[];
  setEvents: (events: EventRow[]) => void;
};

export function useShareSidecar({ shareId, sidecarUrl, accumulateEvents, setEvents }: Args) {
  const [shareMeta, setShareMeta] = useState<ShareMeta>({});
  const [sidecarLoadMsg, setSidecarLoadMsg] = useState('');

  useEffect(() => {
    if (!shareId) return;

    if (!sidecarUrl) {
      setSidecarLoadMsg('sidecarUrl: (none)');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setSidecarLoadMsg('sidecar: loading…');

        // ✅ FIX: fetch sidecar through our Firebase Function proxy to avoid browser CORS issues
        const proxyUrl = `https://us-central1-sports-app-9efb3.cloudfunctions.net/getSidecar?shareId=${encodeURIComponent(
          shareId
        )}`;

        const res = await fetch(proxyUrl);

        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(`sidecar fetch failed (${res.status}): ${txt || res.statusText}`);
        }

        const json = await res.json();

        // meta can be in json.meta, json.data.meta, or top-level
        const meta = (json?.meta ?? json?.data?.meta ?? json) as any;

        const nextMeta: ShareMeta = {
          sport: meta?.sport ?? json?.sport,
          style: meta?.style ?? json?.style,
          athleteName: meta?.athleteName ?? json?.athleteName,
          homeIsAthlete:
            typeof (meta?.homeIsAthlete ?? json?.homeIsAthlete) === 'boolean'
              ? (meta?.homeIsAthlete ?? json?.homeIsAthlete)
              : undefined,
          homeColorIsGreen:
            typeof (meta?.homeColorIsGreen ?? json?.homeColorIsGreen) === 'boolean'
              ? (meta?.homeColorIsGreen ?? json?.homeColorIsGreen)
              : undefined,
          finalScore: meta?.finalScore ?? json?.finalScore,
        };

        // events can be in json.events or json.data.events
        const rawEvents = (json?.events ?? json?.data?.events ?? []) as any[];

        if (!Array.isArray(rawEvents)) {
          throw new Error('sidecar JSON has no events array');
        }

        const normalized: EventRow[] = rawEvents
          .map((e: any) => {
            const t = typeof e?.t === 'number' ? e.t : typeof e?.time === 'number' ? e.time : 0;
            const kind = String(e?.kind ?? e?.key ?? 'unknown');
            const actor: Actor = toActor(e?.actor ?? e?.who ?? 'home');
            const points =
              typeof e?.points === 'number'
                ? e.points
                : typeof e?.value === 'number'
                ? e.value
                : undefined;

            const meta2 = (e?.meta ?? {}) as Record<string, any>;
            const _id = String(e?._id ?? e?.id ?? `${t}-${kind}-${Math.random().toString(36).slice(2, 7)}`);

            return { _id, t, kind, actor, points, meta: meta2 } as EventRow;
          })
          .sort((a, b) => a.t - b.t);

        const withScores = accumulateEvents(normalized);

        if (!cancelled) {
          setShareMeta(nextMeta);
          setEvents(withScores);
          setSidecarLoadMsg(
            `sidecar ✓ events=${withScores.length} sport=${String(nextMeta.sport ?? '')} style=${String(
              nextMeta.style ?? ''
            )}`
          );
        }
      } catch (err: any) {
        if (!cancelled) setSidecarLoadMsg(`sidecar ❌ ${String(err?.message || err)}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shareId, sidecarUrl, accumulateEvents, setEvents]);

  return { shareMeta, sidecarLoadMsg };
}
