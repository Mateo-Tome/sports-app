import { registerSportLibraryBits } from '../sportLibraryStyleRegistry';

function lastMeaningfulEvent(sidecar: any) {
  const events = sidecar?.events;
  if (!Array.isArray(events) || events.length === 0) return null;

  // last event that looks like one of our baseball keys
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    const key = String(ev?.key ?? ev?.kind ?? '').toLowerCase();
    if (
      key === 'strikeout' ||
      key === 'walk' ||
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
  const m = ev?.meta ?? ev?.meta?.meta ?? {};

  if (key === 'strikeout') return 'K';
  if (key === 'walk') return 'BB';
  if (key === 'homerun') return mode === 'pitching' ? 'HR' : 'HR';
  if (key === 'out') {
    const t = String(m?.type ?? '').toLowerCase();
    if (t.includes('ground')) return 'GO';
    if (t.includes('fly')) return 'FO';
    if (t.includes('fielder')) return 'FC';
    return 'OUT';
  }
  if (key === 'hit') {
    const t = String(m?.type ?? '').toLowerCase();
    if (t === 'single') return '1B';
    if (t === 'double') return '2B';
    if (t === 'triple') return '3B';
    if (t === 'bunt') return 'BUNT';
    return 'H';
  }

  return mode === 'pitching' ? 'Pitching' : 'Hitting';
}

function colorFromEvent(ev: any) {
  const m = ev?.meta ?? ev?.meta?.meta ?? {};
  const c = String(m?.pillColor ?? m?.color ?? m?.tint ?? '').trim();
  return c || null;
}

// REGISTER
registerSportLibraryBits(
  (sport) => sport.includes('baseball'),
  ({ sport, sidecar }) => {
    const s = String(sport || '').toLowerCase();
    const mode: 'hitting' | 'pitching' =
      s.includes('pitching') ? 'pitching' : 'hitting';

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
        badgeText: '', // keep empty unless you want extra pills
        badgeColor: edgeColor,
      };
    }

    // hitting
    return {
      hittingLabel: label,
      edgeColor,
      // HR highlight option if you want
      highlightGold: label === 'HR' ? true : null,
    };
  },
);
