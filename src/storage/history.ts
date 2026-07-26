// Historique de lecture (vidéos regardées + musiques écoutées), sur le même
// modèle pub/sub que savedVideos.ts, persisté via AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VideoSummary } from '@/api/youtube';
import type { MusicTrack } from './musicLibrary';

const STORAGE_KEY = '@youtubeclient/history';

// Au-delà de cette taille on tronque les entrées les plus anciennes, pour
// éviter une croissance illimitée du stockage.
const MAX_ENTRIES = 300;

export type HistoryEntry =
  | { kind: 'video'; watchedAt: number; video: VideoSummary }
  | { kind: 'music'; watchedAt: number; track: MusicTrack };

function entryId(entry: HistoryEntry): string {
  return entry.kind === 'video' ? entry.video.id : entry.track.id;
}

let cache: HistoryEntry[] = [];
let loaded = false;
let loadPromise: Promise<HistoryEntry[]> | null = null;
const listeners = new Set<(entries: HistoryEntry[]) => void>();

function notify() {
  for (const listener of listeners) listener(cache);
}

async function persist() {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export function getHistorySync(): HistoryEntry[] {
  return cache;
}

export function loadHistory(): Promise<HistoryEntry[]> {
  if (loaded) return Promise.resolve(cache);
  if (loadPromise) return loadPromise;

  loadPromise = AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      cache = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
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

// Déplace l'entrée en tête de liste et rafraîchit sa date, plutôt que
// d'empiler des doublons à chaque relecture d'une même vidéo/piste.
async function upsert(entry: HistoryEntry): Promise<void> {
  const withoutExisting = cache.filter((e) => !(e.kind === entry.kind && entryId(e) === entryId(entry)));
  cache = [entry, ...withoutExisting].slice(0, MAX_ENTRIES);
  notify();
  await persist();
}

export async function recordVideoWatched(video: VideoSummary): Promise<void> {
  await upsert({ kind: 'video', watchedAt: Date.now(), video });
}

export async function recordMusicPlayed(track: MusicTrack): Promise<void> {
  await upsert({ kind: 'music', watchedAt: Date.now(), track });
}

export async function removeHistoryEntry(kind: HistoryEntry['kind'], id: string): Promise<void> {
  const next = cache.filter((e) => !(e.kind === kind && entryId(e) === id));
  if (next.length === cache.length) return;
  cache = next;
  notify();
  await persist();
}

export async function clearHistory(): Promise<void> {
  if (cache.length === 0) return;
  cache = [];
  notify();
  await persist();
}

export function subscribe(listener: (entries: HistoryEntry[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
