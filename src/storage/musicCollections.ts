// Collections de la bibliothèque musicale, équivalentes à celles de la
// Room DB de Metrolist mais persistées comme le reste de src/storage/ :
// - albums YouTube Music enregistrés,
// - playlists YouTube Music enregistrées.
// Les titres likés, eux, restent gérés par musicLibrary.ts.
import { createListStore } from './listStore';

export interface SavedAlbum {
  /** browseId "MPRE..." de la page album YouTube Music. */
  browseId: string;
  title: string;
  artist: string;
  year: string | null;
  thumbnail: string;
  savedAt: number;
}

export interface SavedPlaylist {
  /** playlistId nue (sans préfixe VL). */
  playlistId: string;
  title: string;
  author: string | null;
  thumbnail: string;
  savedAt: number;
}

export const savedAlbumsStore = createListStore<SavedAlbum>(
  '@youtubeclient/musicSavedAlbums',
  (a) => a.browseId,
);

export const savedPlaylistsStore = createListStore<SavedPlaylist>(
  '@youtubeclient/musicSavedPlaylists',
  (p) => p.playlistId,
);
