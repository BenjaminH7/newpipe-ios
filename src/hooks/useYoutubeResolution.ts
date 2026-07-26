import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeezerTrack } from '@/api/deezer';
import { resolveYoutubeTrack } from '@/api/musicMatch';
import type { VideoSummary } from '@/api/youtube';

const RESOLVE_CONCURRENCY = 3;

export type TrackResolution = VideoSummary | null | 'pending';

// Résout en tâche de fond (petits lots concurrents) une liste de morceaux
// Deezer vers leur équivalent YouTube jouable : la liste "propre" s'affiche
// tout de suite, la lecture se prépare pendant ce temps sans bloquer l'écran.
// Partagé par les écrans artiste et album.
export function useYoutubeResolution(tracks: DeezerTrack[]) {
  const [resolved, setResolved] = useState<Record<number, TrackResolution>>({});
  const resolvedRef = useRef(resolved);
  useEffect(() => {
    resolvedRef.current = resolved;
  }, [resolved]);

  useEffect(() => {
    // Ne réinitialise que si nécessaire : renvoyer la même référence quand
    // l'état est déjà vide évite un re-rendu, et donc une boucle infinie si
    // l'appelant passe un tableau recréé à chaque rendu.
    setResolved((prev) => (Object.keys(prev).length === 0 ? prev : {}));
    if (tracks.length === 0) return;
    let cancelled = false;
    let nextIndex = 0;

    async function worker() {
      while (!cancelled) {
        const i = nextIndex++;
        if (i >= tracks.length) return;
        const track = tracks[i];
        if (resolvedRef.current[track.id] !== undefined) continue;
        setResolved((prev) => ({ ...prev, [track.id]: 'pending' }));
        const match = await resolveYoutubeTrack(track.artist, track.title, track.duration);
        if (cancelled) return;
        setResolved((prev) => ({ ...prev, [track.id]: match }));
      }
    }

    for (let i = 0; i < RESOLVE_CONCURRENCY; i++) worker();
    return () => {
      cancelled = true;
    };
  }, [tracks]);

  const resolveTrack = useCallback(async (track: DeezerTrack): Promise<VideoSummary | null> => {
    let video = resolvedRef.current[track.id];
    if (!video || video === 'pending') {
      setResolved((prev) => ({ ...prev, [track.id]: 'pending' }));
      video = await resolveYoutubeTrack(track.artist, track.title, track.duration);
      setResolved((prev) => ({ ...prev, [track.id]: video }));
    }
    return video;
  }, []);

  return { resolved, resolvedRef, resolveTrack };
}
