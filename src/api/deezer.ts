// Découverte d'artiste "à la Spotify" via l'API publique Deezer (gratuite,
// sans clé) : vraie photo d'artiste + morceaux les plus populaires triés par
// popularité, sans le bruit d'une recherche YouTube brute (covers, réactions,
// compilations...). La lecture reste assurée par YouTube (voir musicMatch.ts) :
// Deezer ne sert ici qu'à obtenir de vraies métadonnées d'artiste.
const DEEZER_BASE = 'https://api.deezer.com';

export interface DeezerArtist {
  id: number;
  name: string;
  pictureUrl: string | null;
  fansCount: number;
}

export interface DeezerTrack {
  id: number;
  title: string;
  artist: string;
  albumCoverUrl: string;
  duration: number;
}

export interface DeezerAlbum {
  id: number;
  title: string;
  coverUrl: string;
  releaseDate: string;
  recordType: string;
  trackCount: number;
}

export interface DeezerAlbumDetails extends DeezerAlbum {
  artistName: string;
  tracks: DeezerTrack[];
}

interface DeezerArtistApi {
  id: number;
  name: string;
  picture_xl?: string;
  picture_big?: string;
  picture_medium?: string;
  nb_fan?: number;
}

interface DeezerTrackApi {
  id: number;
  title: string;
  duration?: number;
  rank?: number;
  artist?: { name?: string };
  album?: { cover_big?: string; cover_medium?: string };
}

interface DeezerAlbumApi {
  id: number;
  title: string;
  cover_xl?: string;
  cover_big?: string;
  cover_medium?: string;
  release_date?: string;
  record_type?: string;
  nb_tracks?: number;
}

export async function searchArtist(name: string): Promise<DeezerArtist | null> {
  const res = await fetch(`${DEEZER_BASE}/search/artist?q=${encodeURIComponent(name)}&limit=1`);
  if (!res.ok) return null;
  const data = await res.json();
  const item = (data?.data ?? [])[0] as DeezerArtistApi | undefined;
  if (!item) return null;
  return {
    id: item.id,
    name: item.name,
    pictureUrl: item.picture_xl || item.picture_big || item.picture_medium || null,
    fansCount: typeof item.nb_fan === 'number' ? item.nb_fan : -1,
  };
}

export async function getArtistTopTracks(artistId: number, limit = 25): Promise<DeezerTrack[]> {
  const res = await fetch(`${DEEZER_BASE}/artist/${artistId}/top?limit=${limit}`);
  if (!res.ok) return [];
  const data = await res.json();
  const items = (data?.data ?? []) as DeezerTrackApi[];

  // Le "top" de Deezer est déjà trié par popularité, mais on re-trie côté
  // client par rang pour honorer explicitement "du plus populaire au moins
  // populaire", même si l'API venait à changer d'ordre.
  return [...items]
    .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
    .map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist?.name ?? '',
      albumCoverUrl: t.album?.cover_big || t.album?.cover_medium || '',
      duration: typeof t.duration === 'number' ? t.duration : -1,
    }));
}

// Discographie de l'artiste (albums, EPs, singles) : même API Deezer que le
// reste de l'écran artiste, donc pas de nouvelle dépendance ni de clé
// supplémentaire à gérer. Triée par date de sortie la plus récente d'abord,
// comme la page artiste de Spotify.
export async function getArtistAlbums(artistId: number, limit = 30): Promise<DeezerAlbum[]> {
  const res = await fetch(`${DEEZER_BASE}/artist/${artistId}/albums?limit=${limit}`);
  if (!res.ok) return [];
  const data = await res.json();
  const items = (data?.data ?? []) as DeezerAlbumApi[];

  return [...items]
    .sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''))
    .map((a) => ({
      id: a.id,
      title: a.title,
      coverUrl: a.cover_xl || a.cover_big || a.cover_medium || '',
      releaseDate: a.release_date ?? '',
      recordType: a.record_type ?? 'album',
      trackCount: typeof a.nb_tracks === 'number' ? a.nb_tracks : -1,
    }));
}

export async function getAlbum(albumId: number): Promise<DeezerAlbumDetails | null> {
  const res = await fetch(`${DEEZER_BASE}/album/${albumId}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.id) return null;

  const coverUrl = data.cover_xl || data.cover_big || data.cover_medium || '';
  const tracks = ((data.tracks?.data ?? []) as DeezerTrackApi[]).map((t) => ({
    id: t.id,
    title: t.title,
    artist: t.artist?.name ?? data.artist?.name ?? '',
    albumCoverUrl: coverUrl,
    duration: typeof t.duration === 'number' ? t.duration : -1,
  }));

  return {
    id: data.id,
    title: data.title,
    coverUrl,
    releaseDate: data.release_date ?? '',
    recordType: data.record_type ?? 'album',
    trackCount: typeof data.nb_tracks === 'number' ? data.nb_tracks : tracks.length,
    artistName: data.artist?.name ?? '',
    tracks,
  };
}
