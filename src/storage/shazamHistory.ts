// Historique des titres reconnus dans l'onglet Shazam, sur le même modèle
// pub/sub que history.ts, persisté via AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MatchedItem } from '@/api/shazamKit';

const STORAGE_KEY = '@youtubeclient/shazamHistory';

// Au-delà de cette taille on tronque les entrées les plus anciennes, pour
// éviter une croissance illimitée du stockage.
const MAX_ENTRIES = 200;

export interface ShazamHistoryEntry {
  id: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  appleMusicUrl?: string;
  matchedAt: number;
}

let cache: ShazamHistoryEntry[] = [];
let loaded = false;
let loadPromise: Promise<ShazamHistoryEntry[]> | null = null;
const listeners = new Set<(entries: ShazamHistoryEntry[]) => void>();

function notify() {
  for (const listener of listeners) listener(cache);
}

async function persist() {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export function getShazamHistorySync(): ShazamHistoryEntry[] {
  return cache;
}

export function loadShazamHistory(): Promise<ShazamHistoryEntry[]> {
  if (loaded) return Promise.resolve(cache);
  if (loadPromise) return loadPromise;

  loadPromise = AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      cache = raw ? (JSON.parse(raw) as ShazamHistoryEntry[]) : [];
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

// Re-reconnaître un même titre le remonte en tête de liste avec une date
// rafraîchie, plutôt que d'empiler des doublons.
export async function recordShazamMatch(item: MatchedItem): Promise<ShazamHistoryEntry> {
  const title = item.title?.trim() || 'Titre inconnu';
  const artist = item.artist?.trim() || 'Artiste inconnu';
  const entry: ShazamHistoryEntry = {
    id: item.shazamID ?? `${title}|${artist}`.toLowerCase(),
    title,
    artist,
    artworkUrl: item.artworkURL,
    appleMusicUrl: item.appleMusicURL,
    matchedAt: Date.now(),
  };
  cache = [entry, ...cache.filter((e) => e.id !== entry.id)].slice(0, MAX_ENTRIES);
  notify();
  await persist();
  return entry;
}

export async function removeShazamEntry(id: string): Promise<void> {
  const next = cache.filter((e) => e.id !== id);
  if (next.length === cache.length) return;
  cache = next;
  notify();
  await persist();
}

export async function clearShazamHistory(): Promise<void> {
  if (cache.length === 0) return;
  cache = [];
  notify();
  await persist();
}

export function subscribe(listener: (entries: ShazamHistoryEntry[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
