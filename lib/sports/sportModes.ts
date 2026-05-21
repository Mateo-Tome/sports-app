import { ALL_SWIM_EVENTS } from './swimmingEvents';

export type SportMode = {
  sport: string;
  style: string;
  title: string;
  subtitle?: string;

  // Optional extra metadata, mainly for swimming import.
  stroke?: string;
  distance?: string;
  raceLabel?: string;
};

export type SportConfig = {
  key: string;
  label: string;
  modes?: SportMode[];
};

function titleCase(value: string) {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const SPORT_CONFIGS: SportConfig[] = [
  {
    key: 'basketball',
    label: 'Basketball',
  },

  {
    key: 'volleyball',
    label: 'Volleyball',
  },

  {
    key: 'wrestling',
    label: 'Wrestling',
    modes: [
      {
        sport: 'wrestling',
        style: 'folkstyle',
        title: 'Folkstyle',
        subtitle: 'High school & college',
      },
      {
        sport: 'wrestling',
        style: 'freestyle',
        title: 'Freestyle',
        subtitle: 'International rules',
      },
      {
        sport: 'wrestling',
        style: 'greco',
        title: 'Greco-Roman',
        subtitle: 'Upper-body only',
      },
    ],
  },

  {
    key: 'baseball',
    label: 'Baseball',
    modes: [
      {
        sport: 'baseball',
        style: 'hitting',
        title: 'Hitting',
      },
      {
        sport: 'baseball',
        style: 'pitching',
        title: 'Pitching',
      },
    ],
  },

  {
    key: 'softball',
    label: 'Softball',
    modes: [
      {
        sport: 'softball',
        style: 'hitting',
        title: 'Hitting',
      },
      {
        sport: 'softball',
        style: 'pitching',
        title: 'Pitching',
      },
    ],
  },

  {
    key: 'bjj',
    label: 'BJJ',
    modes: [
      {
        sport: 'bjj',
        style: 'gi',
        title: 'Gi',
      },
      {
        sport: 'bjj',
        style: 'nogi',
        title: 'No-Gi',
      },
    ],
  },

  {
    key: 'swimming',
    label: 'Swimming',
    modes: ALL_SWIM_EVENTS.map((event) => ({
      sport: 'swimming',
      style: 'race',
      title: event.raceLabel,
      subtitle: `${titleCase(event.stroke)} • ${event.distance}`,
      stroke: event.stroke,
      distance: event.distance,
      raceLabel: event.raceLabel,
    })),
  },
];