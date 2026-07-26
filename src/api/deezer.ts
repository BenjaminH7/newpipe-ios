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
