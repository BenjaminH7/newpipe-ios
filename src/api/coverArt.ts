// Pochette d'une piste ajoutée à la bibliothèque musicale, via l'API iTunes
// Search (gratuite, sans clé) : contrairement au reste de l'app, on ne parle
// pas à YouTube ici, la miniature vidéo n'est qu'un repli temporaire tant que
// l'API n'a pas répondu (ou si elle ne trouve rien).
const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';

export interface TrackMetaGuess {
  title: string;
  artist: string;
}

export interface CoverArtResult {
  artworkUrl: string;
  artist: string | null;
  trackName: string | null;
}

// Bruit fréquent dans les titres YouTube musicaux ("Official Video",
// "Lyrics", "HD"...) qui pollue la recherche sur l'API si on ne le retire pas.
const NOISE_PATTERN =
  /[[(][^\])]*\b(official\s*(music\s*)?video|official\s*audio|lyrics?( video)?|audio|visualizer|hd|4k)\b[^\])]*[\])]/gi;

function cleanTitle(raw: string): string {
  return raw.replace(NOISE_PATTERN, '').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Devine artiste/titre à partir d'un titre de vidéo YouTube : sépare sur un
 * tiret ("Artiste - Titre", convention la plus courante), sinon retombe sur
 * le nom de la chaîne (en retirant le suffixe "- Topic" des chaînes
 * auto-générées par YouTube Music).
 */
export function guessTrackMeta(videoTitle: string, channelName: string): TrackMetaGuess {
  const cleaned = cleanTitle(videoTitle);
  const separatorMatch = cleaned.match(/^(.{1,60}?)\s*[-–—]\s*(.{1,80})$/);
  if (separatorMatch) {
    return { artist: separatorMatch[1].trim(), title: separatorMatch[2].trim() };
  }
  return { artist: channelName.replace(/\s*-\s*Topic$/i, '').trim(), title: cleaned || videoTitle };
}

export async function fetchCoverArt(meta: TrackMetaGuess): Promise<CoverArtResult | null> {
  const term = [meta.artist, meta.title].filter(Boolean).join(' ').trim();
  if (!term) return null;

  const url = `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(term)}&media=music&entity=song&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const result = data?.results?.[0];
  const rawArtwork = result?.artworkUrl100 as string | undefined;
  if (!rawArtwork) return null;

  return {
    artworkUrl: rawArtwork.replace('100x100bb', '600x600bb'),
    artist: (result.artistName as string) ?? null,
    trackName: (result.trackName as string) ?? null,
  };
}
