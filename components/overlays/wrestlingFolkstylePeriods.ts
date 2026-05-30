export type FolkstylePeriodLabel = 'P1' | 'P2' | 'P3' | 'SV' | 'TB1' | 'TB2' | 'UTB';

export type FolkstylePeriodInfo = {
  index: number;
  label: FolkstylePeriodLabel;
  statGroup: 'p1' | 'p2' | 'p3' | 'ot';
  isOvertime: boolean;
  requiresChoice: boolean;
};

export const FOLKSTYLE_PERIODS: FolkstylePeriodInfo[] = [
  { index: 1, label: 'P1', statGroup: 'p1', isOvertime: false, requiresChoice: false },
  { index: 2, label: 'P2', statGroup: 'p2', isOvertime: false, requiresChoice: true },
  { index: 3, label: 'P3', statGroup: 'p3', isOvertime: false, requiresChoice: true },
  { index: 4, label: 'SV', statGroup: 'ot', isOvertime: true, requiresChoice: false },
  { index: 5, label: 'TB1', statGroup: 'ot', isOvertime: true, requiresChoice: true },
  { index: 6, label: 'TB2', statGroup: 'ot', isOvertime: true, requiresChoice: true },
  { index: 7, label: 'UTB', statGroup: 'ot', isOvertime: true, requiresChoice: false },
];

export function getFolkstylePeriod(index: number): FolkstylePeriodInfo {
  return FOLKSTYLE_PERIODS.find((p) => p.index === index) ?? FOLKSTYLE_PERIODS[0];
}

export function getNextFolkstylePeriod(currentIndex: number): FolkstylePeriodInfo {
  const currentIdx = FOLKSTYLE_PERIODS.findIndex((p) => p.index === currentIndex);
  const nextIdx = currentIdx < 0 ? 1 : (currentIdx + 1) % FOLKSTYLE_PERIODS.length;
  return FOLKSTYLE_PERIODS[nextIdx];
}