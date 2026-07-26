// Bibliothèque musicale : pistes ajoutées depuis des vidéos YouTube. On ne
// garde que les métadonnées + la pochette (récupérée via l'API iTunes
// Search, la miniature YouTube n'est qu'un repli) et le fichier audio
// téléchargé en local pour une lecture hors-ligne. Même schéma pub/sub
// qu'ailleurs dans src/storage/ (voir savedVideos.ts).
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VideoSummary } from '@/api/youtube';
import { getVideoInfo } from '@/api/youtube';
import { fetchCoverArt, guessTrackMeta } from '@/api/coverArt';
import { deleteAudioFile, downloadAudioFile } from './musicDownloads';

const STORAGE_KEY = '@youtubeclient/musicLibrary';

export type DownloadStatus = 'downloading' | 'downloaded' | 'failed';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  coverArtUrl: string;
  duration: number;
  addedAt: number;
  localUri: string | null;
  downloadStatus: DownloadStatus;
}

let cache: MusicTrack[] = [];
let loaded = false;
let loadPromise: Promise<MusicTrack[]> | null = null;
const listeners = new Set<(tracks: MusicTrack[]) => void>();

function notify() {
  for (const listener of listeners) listener(cache);
}

async function persist() {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export function getMusicLibrarySync(): MusicTrack[] {
  return cache;
}

export function loadMusicLibrary(): Promise<MusicTrack[]> {
  if (loaded) return Promise.resolve(cache);
  if (loadPromise) return loadPromise;

  loadPromise = AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      cache = raw ? (JSON.parse(raw) as MusicTrack[]) : [];
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

export function isInMusicLibrary(id: string): boolean {
  return cache.some((t) => t.id === id);
}

async function updateTrack(id: string, patch: Partial<MusicTrack>) {
  if (!cache.some((t) => t.id === id)) return;
  cache = cache.map((t) => (t.id === id ? { ...t, ...patch } : t));
  notify();
  await persist();
}

// Best-effort : une erreur ici ne doit jamais empêcher la piste d'exister
// dans la bibliothèque, elle reste juste marquée "failed" (retentable).
async function runDownload(trackId: string) {
  try {
    const { playable } = await getVideoInfo(trackId);
    const remoteUrl =
      playable?.kind === 'dual'
        ? playable.audioUrl
        : playable?.kind === 'single' && !playable.url.includes('.m3u8')
          ? playable.url
          : null;
    if (!remoteUrl) throw new Error('Aucune source audio téléchargeable pour cette piste');
    const localUri = await downloadAudioFile(trackId, remoteUrl);
    await updateTrack(trackId, { downloadStatus: 'downloaded', localUri });
  } catch {
    await updateTrack(trackId, { downloadStatus: 'failed', localUri: null });
  }
}

export async function addToMusicLibrary(video: VideoSummary): Promise<void> {
  if (isInMusicLibrary(video.id)) return;
  const guess = guessTrackMeta(video.title, video.channelName);

  const track: MusicTrack = {
    id: video.id,
    title: guess.title,
    artist: guess.artist,
    coverArtUrl: video.thumbnail,
    duration: video.duration,
    addedAt: Date.now(),
    localUri: null,
    downloadStatus: 'downloading',
  };
  cache = [track, ...cache];
  notify();
  await persist();

  // Pochette externe en tâche de fond : la piste apparaît tout de suite avec
  // la miniature YouTube, remplacée dès que l'API iTunes répond.
  fetchCoverArt(guess)
    .then((art) => {
      if (!art) return;
      return updateTrack(video.id, {
        coverArtUrl: art.artworkUrl,
        title: art.trackName || track.title,
        artist: art.artist || track.artist,
      });
    })
    .catch(() => {});

  runDownload(track.id);
}

export async function removeFromMusicLibrary(id: string): Promise<void> {
  if (!isInMusicLibrary(id)) return;
  cache = cache.filter((t) => t.id !== id);
  notify();
  await persist();
  deleteAudioFile(id);
}

export async function toggleMusicTrack(video: VideoSummary): Promise<void> {
  if (isInMusicLibrary(video.id)) await removeFromMusicLibrary(video.id);
  else await addToMusicLibrary(video);
}

// Ajout d'une piste déjà entièrement résolue (ex. piste en cours de lecture
// venue de l'écran artiste, pas encore dans la bibliothèque) : contrairement
// à addToMusicLibrary(), pas besoin de deviner titre/artiste ni de refaire un
// appel pochette, on a déjà tout.
export async function addMusicTrack(track: MusicTrack): Promise<void> {
  if (isInMusicLibrary(track.id)) return;
  const needsDownload = !track.localUri;
  const entry: MusicTrack = {
    ...track,
    addedAt: Date.now(),
    downloadStatus: needsDownload ? 'downloading' : track.downloadStatus,
  };
  cache = [entry, ...cache];
  notify();
  await persist();
  if (needsDownload) runDownload(track.id);
}

export async function toggleTrackInLibrary(track: MusicTrack): Promise<void> {
  if (isInMusicLibrary(track.id)) await removeFromMusicLibrary(track.id);
  else await addMusicTrack(track);
}

export async function retryMusicDownload(id: string): Promise<void> {
  if (!cache.some((t) => t.id === id)) return;
  await updateTrack(id, { downloadStatus: 'downloading' });
  runDownload(id);
}

export function subscribeMusicLibrary(listener: (tracks: MusicTrack[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
