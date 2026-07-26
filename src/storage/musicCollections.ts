// Collections de la bibliothèque musicale, équivalentes à celles de la
// Room DB de Metrolist mais persistées comme le reste de src/storage/ :
// - albums YouTube Music enregistrés,
// - playlists YouTube Music enregistrées,
// - playlists locales créées dans l'app (avec leurs pistes complètes).
// Les titres likés, eux, restent gérés par musicLibrary.ts.
import type { MusicTrack } from './musicLibrary';
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

export interface LocalPlaylist {
  id: string;
  name: string;
  createdAt: number;
  tracks: MusicTrack[];
}

export const savedPlaylistsStore = createListStore<SavedPlaylist>(
  '@youtubeclient/musicSavedPlaylists',
  (p) => p.playlistId,
);

export const localPlaylistsStore = createListStore<LocalPlaylist>(
  '@youtubeclient/musicLocalPlaylists',
  (p) => p.id,
);

// --- Opérations dédiées aux playlists locales -------------------------------

/** Première occurrence gagne : l'ordre de sélection est conservé. */
function dedupe(tracks: MusicTrack[]): MusicTrack[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

export async function createLocalPlaylist(
  name: string,
  tracks: MusicTrack[] = [],
): Promise<LocalPlaylist> {
  const playlist: LocalPlaylist = {
    id: `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    name: name.trim() || 'Nouvelle playlist',
    createdAt: Date.now(),
    tracks: dedupe(tracks),
  };
  await localPlaylistsStore.add(playlist);
  return playlist;
}

export async function renameLocalPlaylist(id: string, name: string): Promise<void> {
  await localPlaylistsStore.update(id, { name: name.trim() || 'Playlist' });
}

export async function deleteLocalPlaylist(id: string): Promise<void> {
  await localPlaylistsStore.remove(id);
}

/** `false` si la playlist n'existe plus ou contient déjà ce titre. */
export async function addTrackToLocalPlaylist(id: string, track: MusicTrack): Promise<boolean> {
  const playlist = localPlaylistsStore.getSync().find((p) => p.id === id);
  if (!playlist) return false;
  if (playlist.tracks.some((t) => t.id === track.id)) return false;
  await localPlaylistsStore.update(id, { tracks: [...playlist.tracks, track] });
  return true;
}

/** Ajout en lot (sélection multiple depuis la bibliothèque). Renvoie le nombre
 *  de titres réellement ajoutés, les doublons étant ignorés. */
export async function addTracksToLocalPlaylist(
  id: string,
  tracks: MusicTrack[],
): Promise<number> {
  const playlist = localPlaylistsStore.getSync().find((p) => p.id === id);
  if (!playlist) return 0;
  const existing = new Set(playlist.tracks.map((t) => t.id));
  const added = dedupe(tracks).filter((t) => !existing.has(t.id));
  if (added.length === 0) return 0;
  await localPlaylistsStore.update(id, { tracks: [...playlist.tracks, ...added] });
  return added.length;
}

export async function removeTrackFromLocalPlaylist(id: string, trackId: string): Promise<void> {
  const playlist = localPlaylistsStore.getSync().find((p) => p.id === id);
  if (!playlist) return;
  await localPlaylistsStore.update(id, {
    tracks: playlist.tracks.filter((t) => t.id !== trackId),
  });
}

/** Déplace une piste dans la playlist (réordonnancement simple haut/bas). */
export async function moveTrackInLocalPlaylist(
  id: string,
  trackId: string,
  direction: -1 | 1,
): Promise<void> {
  const playlist = localPlaylistsStore.getSync().find((p) => p.id === id);
  if (!playlist) return;
  const index = playlist.tracks.findIndex((t) => t.id === trackId);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= playlist.tracks.length) return;
  const tracks = [...playlist.tracks];
  [tracks[index], tracks[target]] = [tracks[target], tracks[index]];
  await localPlaylistsStore.update(id, { tracks });
}
