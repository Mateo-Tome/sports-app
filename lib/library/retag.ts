// lib/library/retag.ts
// Responsible for retagging/moving a video between athletes/sport folders
// and keeping the sidecar + index + Photos albums in sync.

import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { readIndex, writeIndexAtomic, type IndexMeta } from './indexStore';

const DIR = FileSystem.documentDirectory + 'videos/';

// small helpers local to this module
const ensureDir = async (dir: string) => {
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {}
};

const slug = (s: string) =>
  (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'unknown';

async function pathExists(p: string) {
  try {
    const info: any = await FileSystem.getInfoAsync(p);
    return !!info?.exists;
  } catch {
    return false;
  }
}

async function pickUniqueDest(
  dir: string,
  baseName: string,
  extWithDot: string,
) {
  let n = 0;
  while (true) {
    const name =
      n === 0 ? `${baseName}${extWithDot}` : `${baseName}-${n}${extWithDot}`;
    const dest = `${dir}${name}`;
    if (!(await pathExists(dest))) return { dest, filename: name };
    n++;
  }
}

async function findByFilename(fileName: string): Promise<string | null> {
  try {
    // @ts-ignore
    const athletes: string[] = await (FileSystem as any).readDirectoryAsync(DIR);
    for (const a of athletes) {
      const aDir = `${DIR}${a}/`;
      try {
        // @ts-ignore
        const sports: string[] = await (FileSystem as any).readDirectoryAsync(
          aDir,
        );
        for (const s of sports) {
          const sDir = `${aDir}${s}/`;
          try {
            // @ts-ignore
            const files: string[] = await (FileSystem as any).readDirectoryAsync(
              sDir,
            );
            const cand = files.find((f) => f === fileName);
            if (cand) return sDir + cand;
          } catch {}
        }
      } catch {}
    }
  } catch {}
  return null;
}

async function findByLooseBasename(
  baseNoExt: string,
  extWithDot: string,
): Promise<string | null> {
  try {
    // @ts-ignore
    const athletes: string[] = await (FileSystem as any).readDirectoryAsync(DIR);
    for (const a of athletes) {
      const aDir = `${DIR}${a}/`;
      try {
        // @ts-ignore
        const sports: string[] = await (FileSystem as any).readDirectoryAsync(
          aDir,
        );
        for (const s of sports) {
          const sDir = `${aDir}${s}/`;
          try {
            // @ts-ignore
            const files: string[] = await (FileSystem as any).readDirectoryAsync(
              sDir,
            );
            const cand = files.find(
              (f) =>
                f === `${baseNoExt}${extWithDot}` ||
                (f.startsWith(`${baseNoExt}-`) && f.endsWith(extWithDot)),
            );
            if (cand) return sDir + cand;
          } catch {}
        }
      } catch {}
    }
  } catch {}
  return null;
}

export async function retagVideo(
  input: { uri: string; oldAthlete: string; sportKey: string; assetId?: string },
  newAthleteRaw: string,
) {
  const newAthlete = (newAthleteRaw || '').trim() || 'Unassigned';
  const oldA = (input.oldAthlete || '').trim() || 'Unassigned';
  if (newAthlete === oldA) return;

  // 🔍 Re-resolve source if missing
  let sourceUri = input.uri;
  if (!(await pathExists(sourceUri))) {
    const fileName = input.uri.split('/').pop() || '';
    const dot = fileName.lastIndexOf('.');
    const baseNoExt = dot > 0 ? fileName.slice(0, dot) : fileName;
    const ext = dot > 0 ? fileName.slice(dot) : '.mp4';

    let found = fileName ? await findByFilename(fileName) : null;
    if (!found) found = await findByLooseBasename(baseNoExt, ext);

    if (!found && input.assetId) {
      const list = await readIndex();
      const hit = list.find((m) => m.assetId === input.assetId);
      if (hit && (await pathExists(hit.uri))) found = hit.uri;
    }

    if (found) {
      sourceUri = found;
    } else {
      throw new Error(
        'Original file not found. Tap Refresh; the index may be stale.',
      );
    }
  }

  // ensure destination folders
  const athleteSlug = slug(newAthlete);
  const sportSlug = slug(input.sportKey);
  const newDir = `${DIR}${athleteSlug}/${sportSlug}/`;

  await ensureDir(DIR);
  await ensureDir(`${DIR}${athleteSlug}/`);
  await ensureDir(newDir);

  // compute destination
  const srcName = sourceUri.split('/').pop() || `retag_${Date.now()}.mp4`;
  const dot = srcName.lastIndexOf('.');
  const base = dot > 0 ? srcName.slice(0, dot) : srcName;
  const ext = dot > 0 ? srcName.slice(dot) : '.mp4';

  const { dest: newVideoUri, filename: newFileName } = await pickUniqueDest(
    newDir,
    base,
    ext,
  );

  // sidecar lookup
  const lastSlash = sourceUri.lastIndexOf('/');
  const srcDir = sourceUri.slice(0, lastSlash + 1);
  const sidecarSrcGuess = `${srcDir}${base}.json`;

  let sidecarFrom: string | null = null;
  if (await pathExists(sidecarSrcGuess)) {
    sidecarFrom = sidecarSrcGuess;
  } else {
    try {
      // @ts-ignore
      const files: string[] = await (FileSystem as any).readDirectoryAsync(
        srcDir,
      );
      const cand = files.find(
        (f) => f.toLowerCase() === `${base.toLowerCase()}.json`,
      );
      if (cand) sidecarFrom = srcDir + cand;
    } catch {}
  }

  // move video
  await FileSystem.moveAsync({ from: sourceUri, to: newVideoUri });

  // move sidecar or make new one
  const newBase = newFileName.replace(/\.[^/.]+$/, '');
  let sidecarDest = `${newDir}${newBase}.json`;

  try {
    if (sidecarFrom && (await pathExists(sidecarFrom))) {
      if (await pathExists(sidecarDest))
        sidecarDest = `${newDir}${newBase}-${Date.now()}.json`;
      await FileSystem.moveAsync({ from: sidecarFrom, to: sidecarDest });
    } else {
      const minimal = {
        athlete: newAthlete,
        sport: input.sportKey,
        events: [],
        homeIsAthlete: true,
        finalScore: { home: 0, opponent: 0 },
      };
      await FileSystem.writeAsStringAsync(sidecarDest, JSON.stringify(minimal));
    }
  } catch {
    const minimal = {
      athlete: newAthlete,
      sport: input.sportKey,
      events: [],
      homeIsAthlete: true,
      finalScore: { home: 0, opponent: 0 },
    };
    await FileSystem.writeAsStringAsync(sidecarDest, JSON.stringify(minimal));
  }

  // patch sidecar
  try {
    const txt = await FileSystem.readAsStringAsync(sidecarDest);
    const sc = (txt ? JSON.parse(txt) : {}) as any;
    sc.athlete = newAthlete;
    if (!sc.sport) sc.sport = input.sportKey;
    await FileSystem.writeAsStringAsync(sidecarDest, JSON.stringify(sc));
  } catch {}

  // update index
  const list = await readIndex();
  const updated: IndexMeta[] = list.map((e) =>
    e.uri === input.uri || e.uri === sourceUri
      ? {
          ...e,
          uri: newVideoUri,
          athlete: newAthlete,
          displayName: `${newAthlete} — ${e.sport} — ${new Date(
            e.createdAt,
          ).toLocaleString()}`,
        }
      : e,
  );
  await writeIndexAtomic(updated);

  // update Photos albums
  try {
    const { granted } = await MediaLibrary.requestPermissionsAsync();
    if (!granted || !input.assetId) return;

    const assetId = input.assetId;
    const athleteAlbumName = newAthlete;
    const sportAlbumName = `${newAthlete} — ${input.sportKey}`;

    let a = await MediaLibrary.getAlbumAsync(athleteAlbumName);
    if (!a)
      a = await MediaLibrary.createAlbumAsync(
        athleteAlbumName,
        assetId,
        false,
      );
    else await MediaLibrary.addAssetsToAlbumAsync([assetId], a, false);

    let s = await MediaLibrary.getAlbumAsync(sportAlbumName);
    if (!s)
      s = await MediaLibrary.createAlbumAsync(sportAlbumName, assetId, false);
    else await MediaLibrary.addAssetsToAlbumAsync([assetId], s, false);
  } catch {}
}

// THE FIX: expose as DEFAULT
export default retagVideo;
