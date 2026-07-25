// Préférences globales de l'app (persistées via AsyncStorage), sur le même
// modèle pub/sub que src/storage/savedVideos.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@youtubeclient/settings';

interface Settings {
  skipProductPlacements: boolean;
}

const DEFAULT_SETTINGS: Settings = { skipProductPlacements: true };

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

export function subscribeSettings(listener: (settings: Settings) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
