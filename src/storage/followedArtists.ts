// Artistes musicaux suivis depuis la page artiste, persistés via AsyncStorage.
// Même pattern pub/sub que src/storage/subscriptions.ts. `knownAlbumIds`
// mémorise la discographie déjà vue au moment du suivi puis à chaque
// vérification : le diff avec Deezer donne les nouvelles sorties (voir
// src/api/newReleases.ts).
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FollowedArtist {
  id: number;
  name: string;
  pictureUrl: string | null;
  followedAt: number;
  knownAlbumIds: number[];
}

const STORAGE_KEY = '@youtubeclient/followedArtists';

let cache: FollowedArtist[] = [];
let loaded = false;
let loadPromise: Promise<FollowedArtist[]> | null = null;
const listeners = new Set<(artists: FollowedArtist[]) => void>();

function notify() {
  for (const listener of listeners) listener(cache);
}

async function persist() {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export function getFollowedArtistsSync(): FollowedArtist[] {
  return cache;
}

export function loadFollowedArtists(): Promise<FollowedArtist[]> {
  if (loaded) return Promise.resolve(cache);
  if (loadPromise) return loadPromise;

  loadPromise = AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      cache = raw ? (JSON.parse(raw) as FollowedArtist[]) : [];
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

export function isArtistFollowed(id: number): boolean {
  return cache.some((a) => a.id === id);
}

export async function followArtist(
  artist: { id: number; name: string; pictureUrl: string | null },
  knownAlbumIds: number[],
): Promise<void> {
  if (!artist.id || isArtistFollowed(artist.id)) return;
  cache = [
    {
      id: artist.id,
      name: artist.name,
      pictureUrl: artist.pictureUrl,
      followedAt: Date.now(),
      knownAlbumIds,
    },
    ...cache,
  ];
  notify();
  await persist();
}

export async function unfollowArtist(id: number): Promise<void> {
  if (!isArtistFollowed(id)) return;
  cache = cache.filter((a) => a.id !== id);
  notify();
  await persist();
}

// Ajoute des albums à la discographie connue d'un artiste (union), après une
// vérification : ils ne seront plus signalés comme nouveautés.
export async function recordKnownAlbums(artistId: number, albumIds: number[]): Promise<void> {
  const artist = cache.find((a) => a.id === artistId);
  if (!artist) return;
  const known = new Set(artist.knownAlbumIds);
  const added = albumIds.filter((id) => !known.has(id));
  if (added.length === 0) return;
  cache = cache.map((a) =>
    a.id === artistId ? { ...a, knownAlbumIds: [...a.knownAlbumIds, ...added] } : a,
  );
  notify();
  await persist();
}

export function subscribe(listener: (artists: FollowedArtist[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
