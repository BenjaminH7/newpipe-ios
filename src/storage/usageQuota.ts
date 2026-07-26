// Suivi du temps de lecture quotidien (vidéo / musique séparément), sur le
// même modèle pub/sub qu'ailleurs, persisté via AsyncStorage. Remise à zéro
// automatique dès que la date locale change (minuit). Les cumuls mensuels
// survivent au reset quotidien pour offrir un historique mois par mois.
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@youtubeclient/usageQuota';

// On ignore les écarts de temps réel trop grands entre deux tops (veille de
// l'app, changement d'onglet, etc.) pour ne compter que du temps de lecture
// effectif, pas le temps passé en arrière-plan.
const MAX_TICK_GAP_SECONDS = 3;

// Historique mensuel borné pour éviter une croissance sans fin du stockage.
const MAX_MONTHS_KEPT = 24;

export interface MonthUsage {
  videoSeconds: number;
  musicSeconds: number;
}

export interface UsageState {
  date: string;
  videoSeconds: number;
  musicSeconds: number;
  // Cumuls par mois, clé "AAAA-MM". Le mois courant inclut le jour en cours.
  months: Record<string, MonthUsage>;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function emptyState(): UsageState {
  return { date: todayKey(), videoSeconds: 0, musicSeconds: 0, months: {} };
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
  cache = { ...emptyState(), months: cache.months };
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
      const parsed = raw ? JSON.parse(raw) : null;
      cache = parsed ? { ...emptyState(), ...parsed } : emptyState();
      // Migration : les anciens états n'avaient pas de cumuls mensuels — on
      // ensemence le mois courant avec le compteur du jour déjà accumulé.
      if (parsed && !parsed.months && cache.date === todayKey()) {
        cache.months = {
          [currentMonthKey()]: { videoSeconds: cache.videoSeconds, musicSeconds: cache.musicSeconds },
        };
      }
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

function addSeconds(kind: 'videoSeconds' | 'musicSeconds', seconds: number) {
  rolloverIfNeeded();
  const key = currentMonthKey();
  const month = cache.months[key] ?? { videoSeconds: 0, musicSeconds: 0 };
  const months = { ...cache.months, [key]: { ...month, [kind]: month[kind] + seconds } };
  const keys = Object.keys(months).sort();
  while (keys.length > MAX_MONTHS_KEPT) delete months[keys.shift()!];
  cache = { ...cache, [kind]: cache[kind] + seconds, months };
}

export async function addVideoWatchSeconds(seconds: number): Promise<void> {
  if (seconds <= 0 || seconds > MAX_TICK_GAP_SECONDS) return;
  addSeconds('videoSeconds', seconds);
  notify();
  await persist();
}

export async function addMusicListenSeconds(seconds: number): Promise<void> {
  if (seconds <= 0 || seconds > MAX_TICK_GAP_SECONDS) return;
  addSeconds('musicSeconds', seconds);
  notify();
  await persist();
}

export function subscribeUsage(listener: (state: UsageState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
