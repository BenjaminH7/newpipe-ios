// Convertit un morceau Deezer (métadonnées propres, mais pas jouable) en une
// vidéo YouTube réellement lisible par le lecteur de l'app, via la recherche
// InnerTube existante (voir src/api/youtube.ts). On choisit, parmi les
// premiers résultats, celui dont la durée colle le mieux à la durée Deezer
// connue — un simple titre trouvé au hasard tombe trop souvent sur un remix,
// un live ou une compilation.
import { searchVideos, type VideoSummary } from './youtube';

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
    .catch(() => null);
  cache.set(key, promise);
  return promise;
}
