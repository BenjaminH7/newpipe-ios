// Modèle de données du catalogue YouTube Music, calqué sur les "pages" du
// module innertube de Metrolist/InnerTune (YTItem, HomePage, AlbumPage...)
// mais réduit à la musique : pas de vidéos YouTube classiques ni de podcasts.

/** Un artiste tel qu'il apparaît dans un sous-titre ("run" cliquable ou non). */
export interface ArtistRun {
  name: string;
  /** browseId de chaîne ("UC...") si le run est cliquable, sinon null. */
  id: string | null;
}

export interface YTSong {
  type: 'song';
  /** videoId YouTube : directement jouable par le lecteur existant. */
  id: string;
  title: string;
  artists: ArtistRun[];
  album: { name: string; id: string } | null;
  /** Durée en secondes, -1 si inconnue. */
  duration: number;
  thumbnail: string;
  explicit: boolean;
}

export interface YTAlbum {
  type: 'album';
  /** browseId "MPRE..." — page album. */
  browseId: string;
  /** playlistId associée ("OLAK5uy_...") quand connue : sert à lire l'album d'un coup. */
  playlistId: string | null;
  title: string;
  artists: ArtistRun[];
  year: string | null;
  thumbnail: string;
  explicit: boolean;
}

export interface YTArtist {
  type: 'artist';
  /** browseId de chaîne "UC...". */
  browseId: string;
  name: string;
  thumbnail: string;
  /** Ligne secondaire brute ("Artiste", nombre d'abonnés...). */
  subtitle: string | null;
}

export interface YTPlaylist {
  type: 'playlist';
  /** browseId "VL<playlistId>". */
  browseId: string;
  /** playlistId nue (sans préfixe VL), pour lecture directe. */
  playlistId: string;
  title: string;
  author: string | null;
  subtitle: string | null;
  thumbnail: string;
}

export type YTItem = YTSong | YTAlbum | YTArtist | YTPlaylist;

/** Section de page (carrousel de l'accueil, étagère d'une page artiste...). */
export interface MusicSection {
  title: string;
  /** Strapline au-dessus du titre ("Recommandé pour toi", nom d'artiste...). */
  subtitle: string | null;
  items: YTItem[];
  /** Endpoint "Voir tout" éventuel. */
  moreBrowseId: string | null;
  moreParams: string | null;
}

/** Chip de l'accueil ("Détente", "Énergie"...) : recharge l'accueil filtré. */
export interface HomeChip {
  title: string;
  params: string;
}

export interface MusicHomePage {
  chips: HomeChip[];
  sections: MusicSection[];
  continuation: string | null;
}

export interface AlbumPageData {
  browseId: string;
  playlistId: string | null;
  title: string;
  artists: ArtistRun[];
  year: string | null;
  /** "Album • 2023" tel que fourni par YouTube Music. */
  subtitle: string | null;
  /** "12 titres • 45 minutes". */
  secondSubtitle: string | null;
  thumbnail: string;
  songs: YTSong[];
}

export interface ArtistPageData {
  browseId: string;
  name: string;
  description: string | null;
  thumbnail: string;
  /** Texte d'abonnés localisé ("1,2 M d'abonnés"), null si absent. */
  subscribers: string | null;
  /** Lecture aléatoire officielle de l'artiste (bouton play de la page). */
  shuffleEndpoint: WatchEndpointData | null;
  /** Radio officielle de l'artiste. */
  radioEndpoint: WatchEndpointData | null;
  /** Titres populaires (étagère "Titres"). */
  songs: YTSong[];
  /** browseId ("VL...") de la playlist "tous les titres", si proposée. */
  songsMoreBrowseId: string | null;
  /** Albums, singles, artistes similaires... dans l'ordre de la page. */
  sections: MusicSection[];
}

export interface PlaylistPageData {
  browseId: string;
  playlistId: string;
  title: string;
  author: string | null;
  subtitle: string | null;
  secondSubtitle: string | null;
  thumbnail: string;
  songs: YTSong[];
  continuation: string | null;
}

export interface SearchResultPage {
  items: YTItem[];
  continuation: string | null;
}

/** Cible de lecture InnerTube (bouton aléatoire/radio d'une page artiste). */
export interface WatchEndpointData {
  videoId: string | null;
  playlistId: string | null;
  params: string | null;
}

export interface MoodCategory {
  title: string;
  browseId: string;
  params: string | null;
  /** Couleur de pastille fournie par YouTube Music (hex "#rrggbb"), sinon null. */
  color: string | null;
}

export interface MoodSection {
  title: string;
  categories: MoodCategory[];
}

export interface ArtistItemsPage {
  title: string;
  items: YTItem[];
}
