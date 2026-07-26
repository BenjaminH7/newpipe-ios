// Paroles d'une piste de la bibliothèque musicale, via l'API lrclib.net
// (gratuite, sans clé, alimentée par la communauté). Renvoie des paroles
// synchronisées (LRC) quand elles existent, sinon du texte brut.
const LRCLIB_BASE = 'https://lrclib.net/api';

export interface LyricsLine {
  time: number;
  text: string;
}

export interface LyricsResult {
  synced: LyricsLine[] | null;
  plain: string | null;
}

interface LrclibTrack {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

// Un résultat par piste ne change pas en cours de session : pas besoin de
// re-frapper l'API à chaque ouverture de l'écran "paroles".
const cache = new Map<string, LyricsResult | null>();

const TIME_TAG = /\[(\d{2}):(\d{2})(?:\.(\d{1,2}))?\]/g;

function parseSyncedLyrics(lrc: string): LyricsLine[] {
  const lines: LyricsLine[] = [];
  for (const rawLine of lrc.split('\n')) {
    const tags = [...rawLine.matchAll(TIME_TAG)];
    if (tags.length === 0) continue;
    const text = rawLine.replace(TIME_TAG, '').trim();
    for (const tag of tags) {
      const minutes = parseInt(tag[1], 10);
      const seconds = parseInt(tag[2], 10);
      const centis = tag[3] ? parseInt(tag[3].padEnd(2, '0'), 10) : 0;
      lines.push({ time: minutes * 60 + seconds + centis / 100, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

async function fetchExactMatch(
  title: string,
  artist: string,
  duration: number,
): Promise<LrclibTrack | null> {
  const params = new URLSearchParams({ track_name: title, artist_name: artist });
  if (duration > 0) params.set('duration', String(Math.round(duration)));
  const res = await fetch(`${LRCLIB_BASE}/get?${params}`);
  if (!res.ok) return null; // 404 notamment : pas de correspondance exacte
  return res.json();
}

async function fetchBestSearchMatch(title: string, artist: string): Promise<LrclibTrack | null> {
  const params = new URLSearchParams({ track_name: title, artist_name: artist });
  const res = await fetch(`${LRCLIB_BASE}/search?${params}`);
  if (!res.ok) return null;
  const results = (await res.json()) as LrclibTrack[];
  return Array.isArray(results) && results.length > 0 ? results[0] : null;
}

export async function fetchLyrics(track: {
  id: string;
  title: string;
  artist: string;
  duration: number;
}): Promise<LyricsResult | null> {
  if (cache.has(track.id)) return cache.get(track.id) ?? null;

  const data =
    (await fetchExactMatch(track.title, track.artist, track.duration).catch(() => null)) ??
    (await fetchBestSearchMatch(track.title, track.artist).catch(() => null));

  if (!data || (!data.syncedLyrics && !data.plainLyrics)) {
    cache.set(track.id, null);
    return null;
  }

  const result: LyricsResult = {
    synced: data.syncedLyrics ? parseSyncedLyrics(data.syncedLyrics) : null,
    plain: data.plainLyrics ?? null,
  };
  cache.set(track.id, result);
  return result;
}
