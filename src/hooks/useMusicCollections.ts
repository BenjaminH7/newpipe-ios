// Hooks React au-dessus des collections musicales (albums / playlists
// enregistrés, playlists locales), même pattern que useMusicLibrary.
import { useEffect, useState } from 'react';
import type { ListStore } from '@/storage/listStore';
import {
  localPlaylistsStore,
  savedAlbumsStore,
  savedPlaylistsStore,
  type LocalPlaylist,
  type SavedAlbum,
  type SavedPlaylist,
} from '@/storage/musicCollections';

function useListStore<T>(store: ListStore<T>): T[] {
  const [items, setItems] = useState<T[]>(store.getSync());
  useEffect(() => {
    const unsubscribe = store.subscribe(setItems);
    store.load();
    return () => {
      unsubscribe();
    };
  }, [store]);
  return items;
}

export function useSavedAlbums(): SavedAlbum[] {
  return useListStore(savedAlbumsStore);
}

export function useIsAlbumSaved(browseId: string | null): boolean {
  const albums = useSavedAlbums();
  return browseId !== null && albums.some((a) => a.browseId === browseId);
}

export function useSavedPlaylists(): SavedPlaylist[] {
  return useListStore(savedPlaylistsStore);
}

export function useIsPlaylistSaved(playlistId: string | null): boolean {
  const playlists = useSavedPlaylists();
  return playlistId !== null && playlists.some((p) => p.playlistId === playlistId);
}

export function useLocalPlaylists(): LocalPlaylist[] {
  return useListStore(localPlaylistsStore);
}

export function useLocalPlaylist(id: string | null): LocalPlaylist | null {
  const playlists = useLocalPlaylists();
  return playlists.find((p) => p.id === id) ?? null;
}
