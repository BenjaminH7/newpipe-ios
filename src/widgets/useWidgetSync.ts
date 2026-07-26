// Pousse l'état du lecteur vers les widgets iOS (targets/widget) : piste en
// cours et dernières écoutes. Monté une fois sous <PlayerProvider>.
import { useEffect, useMemo, useRef } from 'react';
import {
  syncWidgets,
  type WidgetPayload,
  type WidgetTrackPayload,
} from '../../modules/widget-data';
import { useHistory } from '@/hooks/useHistory';
import { usePlayer } from '@/player/PlayerContext';
import type { MusicTrack } from '@/storage/musicLibrary';

const RECENT_COUNT = 8;
// Un changement de piste enchaîne plusieurs rendus (piste, puis isPlaying quand
// le flux démarre) : on laisse retomber avant d'écrire et de réveiller WidgetKit.
const DEBOUNCE_MS = 500;

/** Nom de fichier déterministe : le natif ne retélécharge pas ce qu'il a déjà. */
function artworkFileFor(track: { id: string; coverArtUrl?: string }): string | null {
  if (!track.coverArtUrl) return null;
  const safeId = track.id.replace(/[^A-Za-z0-9_-]/g, '');
  return safeId ? `${safeId}.jpg` : null;
}

function toPayload(track: MusicTrack): WidgetTrackPayload {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    artworkFile: artworkFileFor(track),
  };
}

export function useWidgetSync(): void {
  const { currentTrack, isPlaying } = usePlayer();
  const history = useHistory();

  const recent = useMemo(() => {
    const tracks: MusicTrack[] = [];
    for (const entry of history) {
      if (entry.kind !== 'music') continue;
      tracks.push(entry.track);
      if (tracks.length === RECENT_COUNT) break;
    }
    return tracks;
  }, [history]);

  // La signature évite de réécrire (et de réveiller WidgetKit) quand rien de
  // visible n'a bougé — la position de lecture, elle, change à chaque tick.
  const signature = useMemo(
    () =>
      JSON.stringify([
        currentTrack?.id ?? null,
        isPlaying,
        recent.map((t) => t.id),
      ]),
    [currentTrack?.id, isPlaying, recent],
  );

  const lastSignature = useRef<string | null>(null);

  useEffect(() => {
    if (lastSignature.current === signature) return;

    const timer = setTimeout(() => {
      lastSignature.current = signature;

      const payload: WidgetPayload = {
        nowPlaying: currentTrack ? toPayload(currentTrack) : null,
        isPlaying,
        recent: recent.map(toPayload),
      };

      const sources = currentTrack ? [currentTrack, ...recent] : recent;
      const artwork: { file: string; url: string }[] = [];
      const seen = new Set<string>();
      for (const track of sources) {
        const file = artworkFileFor(track);
        if (!file || seen.has(file) || !track.coverArtUrl) continue;
        seen.add(file);
        artwork.push({ file, url: track.coverArtUrl });
      }

      syncWidgets(payload, artwork);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [signature, currentTrack, isPlaying, recent]);
}
