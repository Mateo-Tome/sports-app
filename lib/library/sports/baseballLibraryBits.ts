import { registerSportLibraryBits } from '../sportLibraryStyleRegistry';

function lastMeaningfulEvent(sidecar: any) {
  const events = Array.isArray(sidecar?.events)
  ? [...sidecar.events].sort((a, b) => {
      const ta = typeof a?.t === 'number' ? a.t : 0;
      const tb = typeof b?.t === 'number' ? b.t : 0;
      return ta - tb;
    })
  : null;
  if (!Array.isArray(events) || events.length === 0) return null;

  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    const key = String(ev?.key ?? ev?.kind ?? '').toLowerCase();

    if (
      key === 'strikeout' ||
      key === 'walk' ||
      key === 'hit_by_pitch' ||
      key === 'homerun' ||
      key === 'hit' ||
      key === 'out'
    ) {
      return ev;
    }
  }

  return events[events.length - 1];
}

function shortLabelFromEvent(ev: any, mode: 'hitting' | 'pitching') {
  const key = String(ev?.key ?? ev?.kind ?? '').toLowerCase();
  const m = ev?.meta?.meta ?? ev?.meta ?? {};

  if (key === 'strikeout') return 'K';
  if (key === 'walk') return 'BB';
  if (key === 'hit_by_pitch') return 'HBP';
  if (key === 'homerun') return 'HR';

  if (key === 'out') {
    const t = String(m?.type ?? m?.label ?? ev?.label ?? '').toLowerCase();

    if (t.includes('ground')) return 'GO';
    if (t.includes('fly')) return 'FO';
    if (t.includes('fielder')) return 'FC';
    if (t.includes('pop')) return 'PO';
    if (t.includes('line')) return 'LO';

    return 'OUT';
  }

  if (key === 'hit') {
    const t = String(
      m?.type ??
        m?.hitType ??
        m?.result ??
        m?.label ??
        ev?.label ??
        '',
    ).toLowerCase();

    if (t.includes('single')) return '1B';
    if (t.includes('double')) return '2B';
    if (t.includes('triple')) return '3B';
    if (t.includes('bunt')) return 'BUNT';

    return '1B';
  }

  return mode === 'pitching' ? 'Pitching' : 'Hitting';
}

function colorFromEvent(ev: any) {
  const m = ev?.meta?.meta ?? ev?.meta ?? {};
  const c = String(m?.pillColor ?? m?.color ?? m?.tint ?? '').trim();

  return c || null;
}

// REGISTER
// Baseball and softball share the same hitting/pitching library-label logic.
// This does NOT merge the sports together — it only reuses the label/color builder.
registerSportLibraryBits(
  (sport) => {
    const s = String(sport || '').toLowerCase();
    return s.includes('baseball') || s.includes('softball');
  },
  ({ sport, sidecar }) => {
    const s = String(sport || '').toLowerCase();

    const mode: 'hitting' | 'pitching' = s.includes('pitching')
      ? 'pitching'
      : 'hitting';

    const ev = lastMeaningfulEvent(sidecar);

    if (!ev) {
      return mode === 'pitching'
        ? { pitchingLabel: 'Pitching', edgeColor: null }
        : { hittingLabel: 'Hitting', edgeColor: null };
    }

    const edgeColor = colorFromEvent(ev);
    const label = shortLabelFromEvent(ev, mode);

    if (mode === 'pitching') {
      return {
        pitchingLabel: label,
        edgeColor,
        badgeText: '',
        badgeColor: edgeColor,
      };
    }

    return {
      hittingLabel: label,
      edgeColor,
      highlightGold: label === 'HR' ? true : null,
    };
  },
);