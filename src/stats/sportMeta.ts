export function sportTitle(sportKey: string) {
    // sportKey examples: "wrestling:folkstyle", "baseball:hitting"
    if (sportKey === 'wrestling:folkstyle') return 'Wrestling • Folkstyle';
    if (sportKey === 'baseball:hitting') return 'Baseball • Hitting';
    if (sportKey === 'volleyball:match') return 'Volleyball • Match';
    // fallback:
    return sportKey.replace(':', ' • ');
  }
  