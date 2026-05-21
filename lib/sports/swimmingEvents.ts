export type SwimStroke =
  | 'freestyle'
  | 'backstroke'
  | 'breaststroke'
  | 'butterfly'
  | 'im';

export type SwimEvent = {
  label: string;
  raceLabel: string;
  stroke: SwimStroke;
  distance: string;
};

export type SwimEventGroup = {
  title: string;
  subtitle: string;
  events: SwimEvent[];
};

export const YOUTH_SWIM_EVENTS: SwimEvent[] = [
  { label: '25 Free', raceLabel: '25 Free', stroke: 'freestyle', distance: '25' },
  { label: '25 Back', raceLabel: '25 Back', stroke: 'backstroke', distance: '25' },
  { label: '25 Breast', raceLabel: '25 Breast', stroke: 'breaststroke', distance: '25' },
  { label: '25 Fly', raceLabel: '25 Fly', stroke: 'butterfly', distance: '25' },
];

export const STANDARD_SWIM_EVENT_GROUPS: SwimEventGroup[] = [
  {
    title: 'Freestyle',
    subtitle: 'Free / front crawl',
    events: [
      { label: '50', raceLabel: '50 Free', stroke: 'freestyle', distance: '50' },
      { label: '100', raceLabel: '100 Free', stroke: 'freestyle', distance: '100' },
      { label: '200', raceLabel: '200 Free', stroke: 'freestyle', distance: '200' },
      { label: '400/500', raceLabel: '400/500 Free', stroke: 'freestyle', distance: '400/500' },
      { label: '800/1000', raceLabel: '800/1000 Free', stroke: 'freestyle', distance: '800/1000' },
      { label: '1500/1650', raceLabel: '1500/1650 Free', stroke: 'freestyle', distance: '1500/1650' },
    ],
  },
  {
    title: 'Backstroke',
    subtitle: 'Back',
    events: [
      { label: '50', raceLabel: '50 Back', stroke: 'backstroke', distance: '50' },
      { label: '100', raceLabel: '100 Back', stroke: 'backstroke', distance: '100' },
      { label: '200', raceLabel: '200 Back', stroke: 'backstroke', distance: '200' },
    ],
  },
  {
    title: 'Breaststroke',
    subtitle: 'Breast',
    events: [
      { label: '50', raceLabel: '50 Breast', stroke: 'breaststroke', distance: '50' },
      { label: '100', raceLabel: '100 Breast', stroke: 'breaststroke', distance: '100' },
      { label: '200', raceLabel: '200 Breast', stroke: 'breaststroke', distance: '200' },
    ],
  },
  {
    title: 'Butterfly',
    subtitle: 'Fly',
    events: [
      { label: '50', raceLabel: '50 Fly', stroke: 'butterfly', distance: '50' },
      { label: '100', raceLabel: '100 Fly', stroke: 'butterfly', distance: '100' },
      { label: '200', raceLabel: '200 Fly', stroke: 'butterfly', distance: '200' },
    ],
  },
  {
    title: 'IM',
    subtitle: 'Individual Medley',
    events: [
      { label: '100', raceLabel: '100 IM', stroke: 'im', distance: '100' },
      { label: '200', raceLabel: '200 IM', stroke: 'im', distance: '200' },
      { label: '400', raceLabel: '400 IM', stroke: 'im', distance: '400' },
    ],
  },
];

export const ALL_SWIM_EVENTS: SwimEvent[] = [
  ...YOUTH_SWIM_EVENTS,
  ...STANDARD_SWIM_EVENT_GROUPS.flatMap((group) => group.events),
];