import { registerSportLibraryBits } from '../../sportLibraryStyleRegistry';

registerSportLibraryBits(
  (sport) => sport.startsWith('swimming'),

  ({ sidecar }) => {
    const events = Array.isArray(sidecar?.events) ? sidecar.events : [];

    let finalTimeSec: number | null = null;
    let turnCount = 0;
    let strokeCount = 0;

    let raceLabel = 'Swim';

    for (const e of events) {
      const kind = String(e?.kind ?? e?.key ?? '').toLowerCase();

      const meta = e?.meta ?? {};
      const inner = meta?.meta ?? {};

      const m = {
        ...inner,
        ...meta,
      };

      if (m.raceLabel) {
        raceLabel = String(m.raceLabel);
      }

      if (kind === 'turn_split') {
        turnCount++;
      }

      if (kind === 'stroke_count') {
        strokeCount++;
      }

      if (kind === 'finish_race') {
        const t = Number(m.finalTimeSec);

        if (Number.isFinite(t)) {
          finalTimeSec = t;
        }
      }
    }

    const finalText =
      typeof finalTimeSec === 'number'
        ? finalTimeSec.toFixed(2)
        : '--';

    return {
      edgeColor: 'rgba(14,165,233,0.85)',

      badgeText: `${raceLabel} • ${finalText}s • T${turnCount} • S${strokeCount}`,

      badgeColor: 'rgba(14,165,233,0.95)',
    };
  },
);