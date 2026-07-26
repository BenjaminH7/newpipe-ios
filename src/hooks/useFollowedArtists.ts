import { useCallback, useEffect, useState } from 'react';
import type { FollowedArtist } from '@/storage/followedArtists';
import {
  followArtist,
  getFollowedArtistsSync,
  isArtistFollowed,
  loadFollowedArtists,
  subscribe,
  unfollowArtist,
} from '@/storage/followedArtists';
import { removeArtistReleases } from '@/storage/releasesFeed';

export function useFollowedArtists(): FollowedArtist[] {
  const [artists, setArtists] = useState<FollowedArtist[]>(getFollowedArtistsSync());

  useEffect(() => {
    loadFollowedArtists().then(setArtists);
    return subscribe(setArtists);
  }, []);

  return artists;
}

export function useIsArtistFollowed(artistId: number | null): boolean {
  const artists = useFollowedArtists();
  return artistId !== null && artists.some((a) => a.id === artistId);
}

// `knownAlbumIds` : discographie affichée au moment du suivi, qui sert de
// point de départ au diff des nouveautés (rien d'antérieur au suivi n'entre
// dans le fil). Ignoré pour un désabonnement, qui purge aussi les sorties de
// l'artiste du fil.
export function useToggleArtistFollow(): (
  artist: { id: number; name: string; pictureUrl: string | null },
  knownAlbumIds: number[],
) => void {
  return useCallback((artist, knownAlbumIds) => {
    if (isArtistFollowed(artist.id)) {
      unfollowArtist(artist.id);
      removeArtistReleases(artist.id);
    } else {
      followArtist(artist, knownAlbumIds);
    }
  }, []);
}
