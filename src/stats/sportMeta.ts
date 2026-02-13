export function sportTitle(sportKey: string) {
  // sportKey examples: "wrestling:folkstyle", "baseball:hitting"
  if (sportKey === 'wrestling:folkstyle') return 'Wrestling • Folkstyle';
  if (sportKey === 'wrestling:freestyle') return 'Wrestling • Freestyle';
  if (sportKey === 'wrestling:greco') return 'Wrestling • Greco';

  if (sportKey === 'baseball:hitting') return 'Baseball • Hitting';
  if (sportKey === 'baseball:pitching') return 'Baseball • Pitching';

  if (sportKey === 'volleyball:match') return 'Volleyball • Match';

  // fallback:
  return sportKey.replace(':', ' • ');
}
