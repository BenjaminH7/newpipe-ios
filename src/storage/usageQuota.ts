// Suivi du temps de lecture quotidien (vidéo / musique séparément), sur le
// même modèle pub/sub qu'ailleurs, persisté via AsyncStorage. Remise à zéro
// automatique dès que la date locale change (minuit).
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@youtubeclient/usageQuota';

// Seuil fixe (non configurable) sur le nombre de vidéos distinctes par jour,
// en plus du seuil en minutes qui, lui, est réglable dans les paramètres.
export const VIDEO_COUNT_LIMIT = 3;

// On ignore les écarts de temps réel trop grands entre deux tops (veille de
// l'app, changement d'onglet, etc.) pour ne compter que du temps de lecture
// effectif, pas le temps passé en arrière-plan.
const MAX_TICK_GAP_SECONDS = 3;

interface UsageState {
  date: string;
  videoSeconds: number;
  videoIds: string[];
  musicSeconds: number;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function emptyState(): UsageState {
  return { date: todayKey(), videoSeconds: 0, videoIds: [], musicSeconds: 0 };
}

let cache: UsageState = emptyState();
let loaded = false;
let loadPromise: Promise<UsageState> | null = null;
const listeners = new Set<(state: UsageState) => void>();

function notify() {
  for (const listener of listeners) listener(cache);
}

async function persist() {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

function rolloverIfNeeded(): boolean {
  const today = todayKey();
  if (cache.date === today) return false;
  cache = emptyState();
  return true;
}

export function getUsageSync(): UsageState {
  rolloverIfNeeded();
  return cache;
}

export function loadUsage(): Promise<UsageState> {
  if (loaded) {
    if (rolloverIfNeeded()) {
      notify();
      persist();
    }
    return Promise.resolve(cache);
  }
  if (loadPromise) return loadPromise;

  loadPromise = AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      cache = raw ? { ...emptyState(), ...JSON.parse(raw) } : emptyState();
      rolloverIfNeeded();
      loaded = true;
      notify();
      return cache;
    })
    .catch(() => {
      cache = emptyState();
      loaded = true;
      return cache;
    });

  return loadPromise;
}

export async function addVideoWatchSeconds(id: string, seconds: number): Promise<void> {
  if (seconds <= 0 || seconds > MAX_TICK_GAP_SECONDS) return;
  rolloverIfNeeded();
  const videoIds = cache.videoIds.includes(id) ? cache.videoIds : [...cache.videoIds, id];
  cache = { ...cache, videoSeconds: cache.videoSeconds + seconds, videoIds };
  notify();
  await persist();
}

export async function addMusicListenSeconds(seconds: number): Promise<void> {
  if (seconds <= 0 || seconds > MAX_TICK_GAP_SECONDS) return;
  rolloverIfNeeded();
  cache = { ...cache, musicSeconds: cache.musicSeconds + seconds };
  notify();
  await persist();
}

export function subscribeUsage(listener: (state: UsageState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
