import { useCallback, useEffect, useState } from 'react';
import type { VideoSummary } from '@/api/youtube';
import {
  getMusicLibrarySync,
  loadMusicLibrary,
  removeFromMusicLibrary,
  retryMusicDownload,
  subscribeMusicLibrary,
  toggleMusicTrack,
  type MusicTrack,
} from '@/storage/musicLibrary';

export function useMusicLibrary(): MusicTrack[] {
  const [tracks, setTracks] = useState<MusicTrack[]>(getMusicLibrarySync());

  useEffect(() => {
    loadMusicLibrary().then(setTracks);
    return subscribeMusicLibrary(setTracks);
  }, []);

  return tracks;
}

export function useIsInMusicLibrary(id: string): boolean {
  const tracks = useMusicLibrary();
  return tracks.some((t) => t.id === id);
}

export function useToggleMusicTrack(): (video: VideoSummary) => void {
  return useCallback((video: VideoSummary) => {
    toggleMusicTrack(video);
  }, []);
}

export function useRemoveMusicTrack(): (id: string) => void {
  return useCallback((id: string) => {
    removeFromMusicLibrary(id);
  }, []);
}

export function useRetryMusicDownload(): (id: string) => void {
  return useCallback((id: string) => {
    retryMusicDownload(id);
  }, []);
}
