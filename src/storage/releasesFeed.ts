// Fil des nouvelles sorties (albums / singles / EP) des artistes suivis,
// persisté via AsyncStorage sur le même pattern pub/sub que les autres
// stockages. Alimenté par src/api/newReleases.ts ; l'écran Nouveautés marque
// tout comme vu à l'ouverture, le badge de l'onglet Musique compte les non-vus.
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ReleaseFeedItem {
  /** browseId "MPRE..." de l'album YouTube Music. */
  albumId: string;
  /** browseId "UC..." de l'artiste suivi. */
  artistId: string;
  artistName: string;
  title: string;
  coverUrl: string;
  /** Année de sortie telle que fournie par YouTube Music, ou chaîne vide. */
  releaseDate: string;
  discoveredAt: number;
  seen: boolean;
}

const STORAGE_KEY = '@youtubeclient/releasesFeed';

// Au-delà de cette taille on tronque les entrées les plus anciennes, pour
// éviter une croissance illimitée du stockage.
const MAX_ENTRIES = 200;

let cache: ReleaseFeedItem[] = [];
let loaded = false;
let loadPromise: Promise<ReleaseFeedItem[]> | null = null;
const listeners = new Set<(items: ReleaseFeedItem[]) => void>();

function notify() {
  for (const listener of listeners) listener(cache);
}

async function persist() {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

// Découverte la plus récente d'abord ; à découverte égale, l'année de sortie
// la plus récente (YouTube Music ne donne qu'une année, pas une date pleine).
function sortFeed(items: ReleaseFeedItem[]): ReleaseFeedItem[] {
  return [...items].sort(
    (a, b) => b.discoveredAt - a.discoveredAt || b.releaseDate.localeCompare(a.releaseDate),
  );
}

export function getReleasesFeedSync(): ReleaseFeedItem[] {
  return cache;
}

export function loadReleasesFeed(): Promise<ReleaseFeedItem[]> {
  if (loaded) return Promise.resolve(cache);
  if (loadPromise) return loadPromise;

  loadPromise = AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      const stored = raw ? (JSON.parse(raw) as ReleaseFeedItem[]) : [];
      // Entrées d'avant la bascule sur YouTube Music (ids Deezer numériques).
      cache = stored.filter((i) => typeof i.albumId === 'string');
      loaded = true;
      notify();
      return cache;
    })
    .catch(() => {
      cache = [];
      loaded = true;
      return cache;
    });

  return loadPromise;
}

export async function addReleases(items: ReleaseFeedItem[]): Promise<void> {
  const existing = new Set(cache.map((i) => i.albumId));
  const fresh = items.filter((i) => !existing.has(i.albumId));
  if (fresh.length === 0) return;
  cache = sortFeed([...fresh, ...cache]).slice(0, MAX_ENTRIES);
  notify();
  await persist();
}

export async function markAllReleasesSeen(): Promise<void> {
  if (!cache.some((i) => !i.seen)) return;
  cache = cache.map((i) => (i.seen ? i : { ...i, seen: true }));
  notify();
  await persist();
}

// Un artiste qu'on ne suit plus disparaît du fil avec ses sorties.
export async function removeArtistReleases(artistId: string): Promise<void> {
  const next = cache.filter((i) => i.artistId !== artistId);
  if (next.length === cache.length) return;
  cache = next;
  notify();
  await persist();
}

export function subscribe(listener: (items: ReleaseFeedItem[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
