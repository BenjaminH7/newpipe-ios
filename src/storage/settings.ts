// Préférences globales de l'app (persistées via AsyncStorage), sur le même
// modèle pub/sub que src/storage/savedVideos.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@youtubeclient/settings';

export type ThemeMode = 'system' | 'light' | 'dark';

interface Settings {
  skipProductPlacements: boolean;
  textOnlyMode: boolean;
  translateLyrics: boolean;
  themeMode: ThemeMode;
  videoQuotaMinutes: number;
  musicQuotaMinutes: number;
  hideSubscriptionsTab: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  skipProductPlacements: true,
  textOnlyMode: false,
  translateLyrics: true,
  themeMode: 'system',
  videoQuotaMinutes: 30,
  musicQuotaMinutes: 30,
  hideSubscriptionsTab: false,
};

let cache: Settings = DEFAULT_SETTINGS;
let loaded = false;
let loadPromise: Promise<Settings> | null = null;
const listeners = new Set<(settings: Settings) => void>();

function notify() {
  for (const listener of listeners) listener(cache);
}

async function persist() {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export function getSettingsSync(): Settings {
  return cache;
}

export function loadSettings(): Promise<Settings> {
  if (loaded) return Promise.resolve(cache);
  if (loadPromise) return loadPromise;

  loadPromise = AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      cache = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
      loaded = true;
      notify();
      return cache;
    })
    .catch(() => {
      cache = DEFAULT_SETTINGS;
      loaded = true;
      return cache;
    });

  return loadPromise;
}

export async function setSkipProductPlacements(value: boolean): Promise<void> {
  cache = { ...cache, skipProductPlacements: value };
  notify();
  await persist();
}

export async function setTextOnlyMode(value: boolean): Promise<void> {
  cache = { ...cache, textOnlyMode: value };
  notify();
  await persist();
}

export async function setTranslateLyrics(value: boolean): Promise<void> {
  cache = { ...cache, translateLyrics: value };
  notify();
  await persist();
}

export async function setThemeMode(value: ThemeMode): Promise<void> {
  cache = { ...cache, themeMode: value };
  notify();
  await persist();
}

export async function setVideoQuotaMinutes(value: number): Promise<void> {
  cache = { ...cache, videoQuotaMinutes: value };
  notify();
  await persist();
}

export async function setMusicQuotaMinutes(value: number): Promise<void> {
  cache = { ...cache, musicQuotaMinutes: value };
  notify();
  await persist();
}

export async function setHideSubscriptionsTab(value: boolean): Promise<void> {
  cache = { ...cache, hideSubscriptionsTab: value };
  notify();
  await persist();
}

export function subscribeSettings(listener: (settings: Settings) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
