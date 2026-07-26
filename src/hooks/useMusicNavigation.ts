// Navigation unifiée vers les pages du catalogue YouTube Music : tous les
// écrans partagent les mêmes routes, donc un seul endroit décide où mène un
// YTItem (carte de carrousel, résultat de recherche, artiste d'un titre...).
import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import type { YTItem } from '@/api/ytmusic/types';

export function useMusicNavigation() {
  const router = useRouter();

  const openArtist = useCallback(
    (browseId: string, name?: string) => {
      router.push({ pathname: '/music/artist', params: { browseId, name: name ?? '' } });
    },
    [router],
  );

  const openAlbum = useCallback(
    (browseId: string, title?: string, thumbnail?: string) => {
      router.push({
        pathname: '/music/album',
        params: { browseId, title: title ?? '', thumbnail: thumbnail ?? '' },
      });
    },
    [router],
  );

  const openPlaylist = useCallback(
    (playlistId: string, title?: string, thumbnail?: string) => {
      router.push({
        pathname: '/music/playlist',
        params: { playlistId, title: title ?? '', thumbnail: thumbnail ?? '' },
      });
    },
    [router],
  );

  const openItem = useCallback(
    (item: YTItem) => {
      switch (item.type) {
        case 'artist':
          openArtist(item.browseId, item.name);
          break;
        case 'album':
          openAlbum(item.browseId, item.title, item.thumbnail);
          break;
        case 'playlist':
          openPlaylist(item.playlistId, item.title, item.thumbnail);
          break;
        case 'song':
          break;
      }
    },
    [openAlbum, openArtist, openPlaylist],
  );

  return useMemo(
    () => ({ openArtist, openAlbum, openPlaylist, openItem }),
    [openArtist, openAlbum, openPlaylist, openItem],
  );
}
