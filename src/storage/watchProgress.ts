// Stockage local de la progression de lecture (reprise "là où on en était"),
// sur le même modèle pub/sub que savedVideos.ts, persisté via AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@youtubeclient/watchProgress';

// Au-delà de ce ratio la vidéo est considérée comme terminée : on efface la
// progression pour ne pas proposer de "reprendre" une vidéo déjà finie.
const COMPLETED_RATIO = 0.95;
// En-dessous, on considère que la lecture vient à peine de démarrer : pas
// besoin de sauvegarder une reprise pour quelques secondes.
const MIN_POSITION_SECONDS = 5;

export type WatchProgress = {
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: number;
};

type ProgressMap = Record<string, WatchProgress>;

let cache: ProgressMap = {};
let loaded = false;
let loadPromise: Promise<ProgressMap> | null = null;
const listeners = new Set<(progress: ProgressMap) => void>();

function notify() {
  for (const listener of listeners) listener(cache);
}

async function persist() {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export function getWatchProgressMapSync(): ProgressMap {
  return cache;
}

export function loadWatchProgress(): Promise<ProgressMap> {
  if (loaded) return Promise.resolve(cache);
  if (loadPromise) return loadPromise;

  loadPromise = AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      cache = raw ? (JSON.parse(raw) as ProgressMap) : {};
      loaded = true;
      notify();
      return cache;
    })
    .catch(() => {
      cache = {};
      loaded = true;
      return cache;
    });

  return loadPromise;
}

export function getVideoProgress(id: string): WatchProgress | null {
  return cache[id] ?? null;
}

export async function saveWatchProgress(
  id: string,
  positionSeconds: number,
  durationSeconds: number,
): Promise<void> {
  if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return;
  }

  const finished = positionSeconds / durationSeconds >= COMPLETED_RATIO;
  if (finished || positionSeconds < MIN_POSITION_SECONDS) {
    await clearWatchProgress(id);
    return;
  }

  cache = { ...cache, [id]: { positionSeconds, durationSeconds, updatedAt: Date.now() } };
  notify();
  await persist();
}

export async function clearWatchProgress(id: string): Promise<void> {
  if (!(id in cache)) return;
  const next = { ...cache };
  delete next[id];
  cache = next;
  notify();
  await persist();
}

export function subscribe(listener: (progress: ProgressMap) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
