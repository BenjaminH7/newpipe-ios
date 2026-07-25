// Stockage local des vidéos "à regarder plus tard" (playlist unique, persistée
// sur l'appareil via AsyncStorage). Un petit pub/sub permet à tous les écrans
// (recherche, détail vidéo, playlists) de rester synchronisés sans lib d'état.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VideoSummary } from '@/api/youtube';

const STORAGE_KEY = '@youtubeclient/savedVideos';

let cache: VideoSummary[] = [];
let loaded = false;
let loadPromise: Promise<VideoSummary[]> | null = null;
const listeners = new Set<(videos: VideoSummary[]) => void>();

function notify() {
  for (const listener of listeners) listener(cache);
}

async function persist() {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export function getSavedVideosSync(): VideoSummary[] {
  return cache;
}

export function loadSavedVideos(): Promise<VideoSummary[]> {
  if (loaded) return Promise.resolve(cache);
  if (loadPromise) return loadPromise;

  loadPromise = AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      cache = raw ? (JSON.parse(raw) as VideoSummary[]) : [];
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

export function isVideoSaved(id: string): boolean {
  return cache.some((v) => v.id === id);
}

export async function saveVideo(video: VideoSummary): Promise<void> {
  if (isVideoSaved(video.id)) return;
  cache = [video, ...cache];
  notify();
  await persist();
}

export async function removeSavedVideo(id: string): Promise<void> {
  if (!isVideoSaved(id)) return;
  cache = cache.filter((v) => v.id !== id);
  notify();
  await persist();
}

export async function toggleSavedVideo(video: VideoSummary): Promise<void> {
  if (isVideoSaved(video.id)) await removeSavedVideo(video.id);
  else await saveVideo(video);
}

export function subscribe(listener: (videos: VideoSummary[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
