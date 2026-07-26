// Convertit un morceau Deezer (métadonnées propres, mais pas jouable) en une
// vidéo YouTube réellement lisible par le lecteur de l'app, via la recherche
// InnerTube existante (voir src/api/youtube.ts). On choisit, parmi les
// premiers résultats, celui dont la durée colle le mieux à la durée Deezer
// connue — un simple titre trouvé au hasard tombe trop souvent sur un remix,
// un live ou une compilation.
import type { DeezerTrack } from './deezer';
import { searchVideos, type VideoSummary } from './youtube';
import type { MusicTrack } from '@/storage/musicLibrary';

// Cache de promesses (pas seulement de résultats) : deux appelants qui
// demandent le même morceau en même temps (résolution en tâche de fond +
// appui direct de l'utilisateur) partagent la même requête réseau.
const cache = new Map<string, Promise<VideoSummary | null>>();

function cacheKey(artist: string, title: string): string {
  return `${artist.trim().toLowerCase()}|${title.trim().toLowerCase()}`;
}

function pickBestMatch(items: VideoSummary[], expectedDuration: number): VideoSummary | null {
  if (items.length === 0) return null;
  if (expectedDuration <= 0) return items[0];

  let best = items[0];
  let bestDelta = Infinity;
  for (const item of items.slice(0, 8)) {
    if (item.duration < 0) continue;
    const delta = Math.abs(item.duration - expectedDuration);
    if (delta < bestDelta) {
      best = item;
      bestDelta = delta;
    }
  }
  return best;
}

export function resolveYoutubeTrack(
  artist: string,
  title: string,
  expectedDuration: number,
): Promise<VideoSummary | null> {
  const key = cacheKey(artist, title);
  const existing = cache.get(key);
  if (existing) return existing;

  const promise = searchVideos(`${artist} ${title}`)
    .then((res) => pickBestMatch(res.items, expectedDuration))
    .catch(() => null)
    .then((match) => {
      // Échec (réseau coupé, recherche vide) : on ne garde pas le null en
      // cache, sinon le morceau resterait introuvable pour toute la session.
      if (match === null && cache.get(key) === promise) cache.delete(key);
      return match;
    });
  cache.set(key, promise);
  return promise;
}

// Assemble un morceau jouable (résolu côté YouTube) et ses métadonnées
// Deezer d'origine en un MusicTrack, format commun à la lecture et à la
// bibliothèque musicale. Partagé par les écrans artiste et album.
export function toMusicTrack(video: VideoSummary, track: DeezerTrack): MusicTrack {
  return {
    id: video.id,
    title: track.title,
    artist: track.artist,
    coverArtUrl: track.albumCoverUrl || video.thumbnail,
    duration: track.duration >= 0 ? track.duration : video.duration,
    addedAt: Date.now(),
    localUri: null,
    // N'est pas vraiment téléchargé : ce champ n'est consulté que par la
    // bibliothèque musicale (src/storage/musicLibrary.ts), jamais par la lecture.
    downloadStatus: 'downloaded',
  };
}

// Entrée de file "différée" : morceau Deezer dont l'équivalent YouTube n'est
// pas encore connu au moment où la file est construite (la résolution tourne
// en tâche de fond, voir useYoutubeResolution). L'id sentinelle "deezer:<id>"
// est résolu par le lecteur (PlayerContext) juste avant lecture ou en
// préchargement — il ne doit jamais atteindre getVideoInfo.
const PENDING_ID_PREFIX = 'deezer:';

export function pendingTrackId(track: DeezerTrack): string {
  return `${PENDING_ID_PREFIX}${track.id}`;
}

export function isPendingMusicTrack(track: MusicTrack): boolean {
  return track.id.startsWith(PENDING_ID_PREFIX);
}

export function pendingMusicTrack(track: DeezerTrack): MusicTrack {
  return {
    id: pendingTrackId(track),
    title: track.title,
    artist: track.artist,
    coverArtUrl: track.albumCoverUrl,
    duration: track.duration,
    addedAt: Date.now(),
    localUri: null,
    downloadStatus: 'downloaded',
  };
}

// Résout une entrée différée vers sa vidéo YouTube en conservant les
// métadonnées Deezer d'origine. Passe par le même cache que la résolution en
// tâche de fond des écrans album/artiste : aucune recherche dupliquée.
export async function resolvePendingMusicTrack(track: MusicTrack): Promise<MusicTrack | null> {
  const video = await resolveYoutubeTrack(track.artist, track.title, track.duration);
  if (!video) return null;
  return {
    ...track,
    id: video.id,
    coverArtUrl: track.coverArtUrl || video.thumbnail,
    duration: track.duration >= 0 ? track.duration : video.duration,
  };
}

// Convertit un résultat de radio YouTube (getRadioQueue) en MusicTrack : pas
// de fiche Deezer ici, donc le nom de la chaîne sert de "artiste" au mieux —
// suffisant pour l'affichage, moins fiable que le matching Deezer utilisé
// ailleurs pour la recherche par artiste.
export function radioTrackToMusicTrack(video: VideoSummary): MusicTrack {
  return {
    id: video.id,
    title: video.title,
    artist: video.channelName || 'YouTube',
    coverArtUrl: video.thumbnail,
    duration: video.duration,
    addedAt: Date.now(),
    localUri: null,
    downloadStatus: 'downloaded',
  };
}
