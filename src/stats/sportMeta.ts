export function sportTitle(sportKey: string) {
  if (sportKey === 'wrestling:folkstyle') return 'Wrestling • Folkstyle';
  if (sportKey === 'wrestling:freestyle') return 'Wrestling • Freestyle';
  if (sportKey === 'wrestling:greco') return 'Wrestling • Greco';

  if (sportKey === 'baseball:hitting') return 'Baseball • Hitting';
  if (sportKey === 'baseball:pitching') return 'Baseball • Pitching';

  if (sportKey === 'basketball:default') return 'Basketball';

  if (sportKey === 'volleyball:default') return 'Volleyball';
  if (sportKey === 'volleyball:match') return 'Volleyball • Match';

  if (sportKey === 'bjj:default') return 'BJJ';
  if (sportKey === 'bjj:gi') return 'BJJ • Gi';
  if (sportKey === 'bjj:nogi') return 'BJJ • No-Gi';

  return sportKey.replace(':', ' • ');
}