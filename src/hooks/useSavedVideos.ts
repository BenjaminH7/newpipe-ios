import { useCallback, useEffect, useState } from 'react';
import type { VideoSummary } from '@/api/youtube';
import {
  getSavedVideosSync,
  loadSavedVideos,
  subscribe,
  toggleSavedVideo,
} from '@/storage/savedVideos';

export function useSavedVideos(): VideoSummary[] {
  const [videos, setVideos] = useState<VideoSummary[]>(getSavedVideosSync());

  useEffect(() => {
    loadSavedVideos().then(setVideos);
    return subscribe(setVideos);
  }, []);

  return videos;
}

export function useIsVideoSaved(id: string): boolean {
  const videos = useSavedVideos();
  return videos.some((v) => v.id === id);
}

export function useToggleSavedVideo(): (video: VideoSummary) => void {
  return useCallback((video: VideoSummary) => {
    toggleSavedVideo(video);
  }, []);
}
