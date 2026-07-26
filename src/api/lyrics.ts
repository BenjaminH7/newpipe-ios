// Paroles d'une piste de la bibliothèque musicale, via l'API lrclib.net
// (gratuite, sans clé, alimentée par la communauté). Renvoie des paroles
// synchronisées (LRC) quand elles existent, sinon du texte brut.
const LRCLIB_BASE = 'https://lrclib.net/api';
// Réseau best-effort : on coupe court aux requêtes qui traînent et on retente
// une fois, plutôt que de laisser l'écran "paroles" bloqué en chargement.
const FETCH_TIMEOUT_MS = 8000;
// Au-delà de cet écart entre la durée de notre piste et celle du morceau
// lrclib, les paroles synchronisées seraient visiblement décalées : on les
// affiche alors en texte brut plutôt que de dérouler une synchro fausse.
const MAX_SYNC_DRIFT_SECONDS = 10;

export interface LyricsLine {
  time: number;
  text: string;
}

export interface LyricsResult {
  synced: LyricsLine[] | null;
  plain: string | null;
}

interface LrclibTrack {
  trackName?: string | null;
  artistName?: string | null;
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
// "[Official Video]", "feat. X", "| Out now"... — qui fait systématiquement
// échouer la recherche lrclib si on l'envoie tel quel.
const NOISE_KEYWORD =
  'officie?l(?:le)?|official|video|vidéo|clip|lyrics?|paroles?|letra|audio|visuali[sz]er|remaster(?:ed)?|live|version|extended|explicit|hd|hq|4k|8k|mv|sub(?:s|titles?)?|traduction|translation|legendado|color\\s*coded|out\\s*now|premiere|prod\\.?';
const BRACKET_NOISE = new RegExp(
  `[(\\[{【][^)\\]}】]*(?:${NOISE_KEYWORD})[^)\\]}】]*[)\\]}】]`,
  'gi',
);
// "feat./ft./featuring X", entre parenthèses ou non. On s'arrête au premier
// tiret ou pipe pour ne pas avaler un éventuel "- Titre" qui suit.
const FEAT = /[(\[{]?\s*\b(?:feat\.?|ft\.?|featuring)\s+[^)\]}|–—-]+[)\]}]?/gi;

function cleanTitle(raw: string): string {
  // Ce qui suit un "|" est quasi toujours promotionnel ("... | Album dispo").
  const beforePipe = raw.split('|')[0].trim();
  const base = beforePipe || raw;
  const cleaned = base
    .replace(BRACKET_NOISE, ' ')
    .replace(FEAT, ' ')
    .replace(/(officie?l(?:le)?|official)\s*(music\s*)?(video|vidéo|clip|audio)/gi, ' ')
    .replace(/(video|vidéo|clip|audio|lyric)\s*(officie?l(?:le)?|official)/gi, ' ')
    .replace(/\b(?:lyric\s+video|video\s+lyrics?|lyrics|paroles)\s*$/i, ' ')
    .replace(/#[\p{L}\p{N}_]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^["'«»“”‘’\s]+|["'«»“”‘’\s]+$/g, '')
    .trim();
  return cleaned || raw.trim();
}

function cleanArtist(raw: string): string {
  const cleaned = raw
    .replace(/\s*-\s*topic$/i, '')
    .replace(/vevo$/i, '')
    .replace(/\s+(officie?l(?:le)?|official)$/i, '')
    .replace(FEAT, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || raw.trim();
}

// "A & B", "A, B", "A x B" : lrclib ne crédite souvent que l'artiste principal.
function primaryArtist(artist: string): string {
  const first = artist.split(/\s*(?:,|&|×|\sx\s)\s*/i)[0]?.trim() ?? '';
  return first || artist;
}

// Comparaison tolérante à la casse, aux accents et à la ponctuation : on
// découpe en mots normalisés et on mesure le recouvrement des deux ensembles.
function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  );
}

function similarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const token of ta) if (tb.has(token)) common++;
  return common / Math.max(ta.size, tb.size);
}

function hasLyrics(track: LrclibTrack | null | undefined): track is LrclibTrack {
  return !!track && !!(track.syncedLyrics || track.plainLyrics);
}

// 404 = "pas de correspondance", réponse définitive. Tout le reste (timeout,
// 5xx, coupure) est une panne réseau : on retente une fois, puis on laisse
// l'erreur remonter pour ne pas mettre en cache un faux "pas de paroles".
async function fetchJson(url: string): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`lrclib ${res.status}`);
      return await res.json();
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

interface Wanted {
  title: string;
  artist: string;
  duration: number;
}

function durationGap(track: LrclibTrack, wanted: Wanted): number | null {
  if (!(wanted.duration > 0) || typeof track.duration !== 'number') return null;
  return Math.abs(track.duration - wanted.duration);
}

// Le premier résultat de /search n'est pas forcément le bon (instrumental,
// reprise, autre chanson au titre proche...). On note chaque candidat sur la
// ressemblance titre/artiste et la proximité de durée, et on refuse tout
// candidat trop éloigné : mieux vaut "paroles indisponibles" que les paroles
// d'un autre morceau.
function pickBestCandidate(results: LrclibTrack[], wanted: Wanted): LrclibTrack | null {
  const candidates = results.filter(hasLyrics).filter((t) => {
    const gap = durationGap(t, wanted);
    if (gap !== null && gap > 60) return false;
    const titleSim = similarity(t.trackName ?? '', wanted.title);
    return titleSim >= 0.5 || (gap !== null && gap <= MAX_SYNC_DRIFT_SECONDS && titleSim >= 0.2);
  });
  const score = (t: LrclibTrack) => {
    let s = t.syncedLyrics ? 1 : 0;
    s += similarity(t.trackName ?? '', wanted.title) * 4;
    s += similarity(t.artistName ?? '', wanted.artist) * 2;
    const gap = durationGap(t, wanted);
    if (gap !== null) {
      if (gap <= 3) s += 4;
      else if (gap <= MAX_SYNC_DRIFT_SECONDS) s += 3;
      else if (gap <= 20) s += 1;
    }
    return s;
  };
  return candidates.sort((a, b) => score(b) - score(a))[0] ?? null;
}

async function fetchExactMatch(
  title: string,
  artist: string,
  duration: number,
): Promise<LrclibTrack | null> {
  const params = new URLSearchParams({ track_name: title, artist_name: artist });
  if (duration > 0) params.set('duration', String(Math.round(duration)));
  return (await fetchJson(`${LRCLIB_BASE}/get?${params}`)) as LrclibTrack | null;
}

async function searchBestMatch(
  params: Record<string, string>,
  wanted: Wanted,
): Promise<LrclibTrack | null> {
  const results = await fetchJson(`${LRCLIB_BASE}/search?${new URLSearchParams(params)}`);
  if (!Array.isArray(results)) return null;
  return pickBestCandidate(results as LrclibTrack[], wanted);
}

// Variantes de requête à essayer dans l'ordre. Cas fréquents sur YouTube :
// tout est dans le titre ("Artiste - Titre" ou "Titre - Artiste") et le champ
// artiste n'est que le nom de la chaîne ; ou l'artiste liste des invités que
// lrclib ne connaît pas ("A & B" crédité "A").
function buildQueries(title: string, artist: string): Array<{ title: string; artist: string }> {
  const queries = [{ title, artist }];
  const main = primaryArtist(artist);
  if (main !== artist) queries.push({ title, artist: main });
  const dash = title.split(/\s+[-–—]\s+/);
  if (dash.length >= 2 && dash[0] && dash[1]) {
    const rest = dash.slice(1).join(' ');
    queries.push({ artist: dash[0], title: rest });
    queries.push({ artist: rest, title: dash[0] });
  }
  const seen = new Set<string>();
  return queries.filter((q) => {
    const key = `${q.artist.toLowerCase()}|${q.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

  const title = cleanTitle(track.title);
  const artist = cleanArtist(track.artist);

  let data: LrclibTrack | null = null;
  for (const q of buildQueries(title, artist)) {
    const wanted: Wanted = { title: q.title, artist: q.artist, duration: track.duration };
    const exact = await attempt(() => fetchExactMatch(q.title, q.artist, track.duration));
    data = hasLyrics(exact)
      ? exact
      : await attempt(() => searchBestMatch({ track_name: q.title, artist_name: q.artist }, wanted));
    if (hasLyrics(data)) break;
    data = null;
  }

  // Derniers recours : recherche plein texte, filtrée par le même scoring
  // (durée + similarité) pour ne pas ramener n'importe quoi.
  if (!data) {
    const wanted: Wanted = { title, artist, duration: track.duration };
    data =
      (await attempt(() => searchBestMatch({ q: `${artist} ${title}`.trim() }, wanted))) ??
      (await attempt(() => searchBestMatch({ q: title }, wanted)));
  }

  let synced = data?.syncedLyrics ? parseSyncedLyrics(data.syncedLyrics) : null;
  if (synced && synced.length === 0) synced = null;
  let plain = data?.plainLyrics ?? null;

  // Durée trop différente : la synchro déroulerait en décalé. On bascule en
  // texte brut (reconstruit depuis le LRC si besoin) plutôt que de mentir.
  if (synced && data) {
    const gap = durationGap(data, { title, artist, duration: track.duration });
    if (gap !== null && gap > MAX_SYNC_DRIFT_SECONDS) {
      if (!plain) plain = synced.map((line) => line.text).join('\n');
      synced = null;
    }
  }

  const result: LyricsResult | null = synced || plain ? { synced, plain } : null;
  if (result || !networkFailed) cache.set(track.id, result);
  return result;
}
