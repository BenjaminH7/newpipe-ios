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
  duration?: number | null;
}

// Un résultat par piste ne change pas en cours de session : pas besoin de
// re-frapper l'API à chaque ouverture de l'écran "paroles".
const cache = new Map<string, LyricsResult | null>();

// Les LRC de lrclib mélangent les formats : minutes sur 1 à 3 chiffres,
// fraction en centièmes ([mm:ss.xx]) ou en millièmes ([mm:ss.xxx]).
const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

function parseSyncedLyrics(lrc: string): LyricsLine[] {
  const lines: LyricsLine[] = [];
  for (const rawLine of lrc.split('\n')) {
    const tags = [...rawLine.matchAll(TIME_TAG)];
    if (tags.length === 0) continue;
    const text = rawLine.replace(TIME_TAG, '').trim();
    for (const tag of tags) {
      const minutes = parseInt(tag[1], 10);
      const seconds = parseInt(tag[2], 10);
      const fraction = tag[3] ? parseInt(tag[3].padEnd(3, '0'), 10) / 1000 : 0;
      lines.push({ time: minutes * 60 + seconds + fraction, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

// Les titres venus de YouTube charrient du bruit — "(Clip officiel)",
// "[Official Video]", "Artiste - Titre", chaîne "Artiste - Topic"... — qui
// fait systématiquement échouer la recherche lrclib si on l'envoie tel quel.
const TITLE_NOISE =
  /[([{][^)\]}]*(officie?l|official|video|vidéo|clip|lyric|parole|audio|visuali[sz]er|remaster|live|version|extended|hd|hq|4k|mv)[^)\]}]*[)\]}]/gi;

function cleanTitle(raw: string): string {
  const cleaned = raw
    .replace(TITLE_NOISE, ' ')
    .replace(/(officie?l|official)\s*(music\s*)?(video|vidéo|clip)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || raw.trim();
}

function cleanArtist(raw: string): string {
  const cleaned = raw
    .replace(/\s*-\s*topic$/i, '')
    .replace(/vevo$/i, '')
    .trim();
  return cleaned || raw.trim();
}

// Variantes de requête à essayer dans l'ordre. Cas fréquent sur YouTube :
// tout est dans le titre ("Artiste - Titre") et le champ artiste n'est que le
// nom de la chaîne — on tente alors aussi la découpe sur le tiret.
function buildQueries(title: string, artist: string): Array<{ title: string; artist: string }> {
  const queries = [{ title, artist }];
  const dash = title.split(/\s+[-–—]\s+/);
  if (dash.length === 2 && dash[0] && dash[1]) {
    queries.push({ artist: dash[0], title: dash[1] });
  }
  const seen = new Set<string>();
  return queries.filter((q) => {
    const key = `${q.artist.toLowerCase()}|${q.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasLyrics(track: LrclibTrack | null | undefined): track is LrclibTrack {
  return !!track && !!(track.syncedLyrics || track.plainLyrics);
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

async function fetchBestSearchMatch(
  title: string,
  artist: string,
  duration: number,
): Promise<LrclibTrack | null> {
  const params = new URLSearchParams({ track_name: title, artist_name: artist });
  const res = await fetch(`${LRCLIB_BASE}/search?${params}`);
  if (!res.ok) return null;
  const results = (await res.json()) as LrclibTrack[];
  if (!Array.isArray(results)) return null;
  // Le premier résultat n'est pas forcément le bon (instrumental, autre
  // version...). On privilégie une durée proche de la piste — sinon les
  // paroles synchronisées seraient décalées — puis la présence de synchro.
  const score = (t: LrclibTrack) => {
    let s = t.syncedLyrics ? 2 : 0;
    if (duration > 0 && typeof t.duration === 'number' && Math.abs(t.duration - duration) <= 7) s += 3;
    return s;
  };
  return results.filter(hasLyrics).sort((a, b) => score(b) - score(a))[0] ?? null;
}

export async function fetchLyrics(track: {
  id: string;
  title: string;
  artist: string;
  duration: number;
}): Promise<LyricsResult | null> {
  if (cache.has(track.id)) return cache.get(track.id) ?? null;

  // Un échec réseau n'est pas un "pas de paroles" définitif : dans ce cas on
  // ne met rien en cache, pour retenter à la prochaine occasion.
  let networkFailed = false;
  const attempt = async (fn: () => Promise<LrclibTrack | null>): Promise<LrclibTrack | null> => {
    try {
      return await fn();
    } catch {
      networkFailed = true;
      return null;
    }
  };

  let data: LrclibTrack | null = null;
  for (const q of buildQueries(cleanTitle(track.title), cleanArtist(track.artist))) {
    const exact = await attempt(() => fetchExactMatch(q.title, q.artist, track.duration));
    data = hasLyrics(exact) ? exact : await attempt(() => fetchBestSearchMatch(q.title, q.artist, track.duration));
    if (hasLyrics(data)) break;
    data = null;
  }

  const synced = data?.syncedLyrics ? parseSyncedLyrics(data.syncedLyrics) : null;
  const result: LyricsResult | null =
    (synced && synced.length > 0) || data?.plainLyrics
      ? { synced: synced && synced.length > 0 ? synced : null, plain: data?.plainLyrics ?? null }
      : null;

  if (result || !networkFailed) cache.set(track.id, result);
  return result;
}
