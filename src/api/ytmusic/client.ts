// Client InnerTube YouTube Music (WEB_REMIX) : reproduit côté app les pages
// du client officiel music.youtube.com — accueil personnalisé, recherche
// filtrée, albums, artistes, playlists, file "à suivre"/radio, moods & genres,
// charts — comme le module innertube de Metrolist, réduit à la musique.
// La lecture, elle, reste assurée par le pipeline existant (src/api/youtube.ts) :
// un YTSong porte un videoId ordinaire.
import {
  findAll,
  findFirst,
  joinRuns,
  lastThumbnail,
  parseListItem,
  parseMoodSections,
  parseQueueItem,
  parseSections,
  parseTwoRowItem,
} from './parse';
import type {
  AlbumPageData,
  ArtistItemsPage,
  ArtistPageData,
  ArtistRun,
  HomeChip,
  MoodSection,
  MusicHomePage,
  MusicSection,
  PlaylistPageData,
  SearchResultPage,
  WatchEndpointData,
  YTAlbum,
  YTItem,
  YTSong,
} from './types';

const MUSIC_API_URL = 'https://music.youtube.com/youtubei/v1/';
// Version WEB_REMIX alignée sur celle utilisée par Metrolist (YouTubeClient.kt).
const WEB_REMIX_CLIENT_VERSION = '1.20260114.03.00';

const MUSIC_HEADERS = {
  'Content-Type': 'application/json',
  Origin: 'https://music.youtube.com',
  Referer: 'https://music.youtube.com/',
  'X-YouTube-Client-Name': '67',
  'X-YouTube-Client-Version': WEB_REMIX_CLIENT_VERSION,
  Cookie: 'SOCS=CAE=',
};

// hl=fr pour des titres de sections localisés ("Sélection rapide"...) ; le
// parsing, lui, ne dépend jamais de la langue (browseIds et formes de texte).
function musicContext() {
  return {
    client: {
      clientName: 'WEB_REMIX',
      clientVersion: WEB_REMIX_CLIENT_VERSION,
      hl: 'fr',
      gl: 'FR',
      utcOffsetMinutes: 0,
    },
    request: { internalExperimentFlags: [], useSsl: true, user: { lockedSafetyMode: false } },
  };
}

async function musicPost(endpoint: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${MUSIC_API_URL}${endpoint}?prettyPrint=false`, {
    method: 'POST',
    headers: MUSIC_HEADERS,
    body: JSON.stringify({ context: musicContext(), ...body }),
  });
  if (!res.ok) throw new Error(`YouTube Music ${endpoint} a répondu ${res.status}`);
  return res.json();
}

/** Contenu du sectionListRenderer du premier onglet d'une réponse browse. */
function sectionListOf(data: any): { contents: any[]; header: any; continuation: string | null } {
  const sectionList =
    data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer ??
    data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer ??
    null;
  return {
    contents: sectionList?.contents ?? [],
    header: sectionList?.header ?? null,
    continuation:
      sectionList?.continuations?.[0]?.nextContinuationData?.continuation ?? null,
  };
}

// ---------------------------------------------------------------------------
// Accueil (FEmusic_home)

function parseHomeChips(header: any): HomeChip[] {
  const chips: HomeChip[] = [];
  for (const chip of header?.chipCloudRenderer?.chips ?? []) {
    const r = chip?.chipCloudChipRenderer;
    const params = r?.navigationEndpoint?.browseEndpoint?.params;
    const title = joinRuns(r?.text);
    if (params && title) chips.push({ title, params });
  }
  return chips;
}

export async function getMusicHome(options?: {
  params?: string;
  continuation?: string;
}): Promise<MusicHomePage> {
  if (options?.continuation) {
    const data = await musicPost('browse', { continuation: options.continuation });
    const cont = data?.continuationContents?.sectionListContinuation;
    return {
      chips: [],
      sections: parseSections(cont?.contents ?? []),
      continuation: cont?.continuations?.[0]?.nextContinuationData?.continuation ?? null,
    };
  }
  const data = await musicPost('browse', {
    browseId: 'FEmusic_home',
    ...(options?.params ? { params: options.params } : {}),
  });
  const { contents, header, continuation } = sectionListOf(data);
  return { chips: parseHomeChips(header), sections: parseSections(contents), continuation };
}

// ---------------------------------------------------------------------------
// Recherche (filtres musique uniquement — pas de vidéos YouTube)

// Params de filtre InnerTube (protobuf encodé), mêmes valeurs que
// Metrolist/InnerTune et ytmusicapi.
export const MUSIC_SEARCH_FILTERS = {
  songs: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D',
  albums: 'EgWKAQIYAWoKEAkQChAFEAMQBA%3D%3D',
  artists: 'EgWKAQIgAWoKEAkQChAFEAMQBA%3D%3D',
  featuredPlaylists: 'EgeKAQQoADgBagwQDhAKEAMQBRAJEAQ%3D',
  communityPlaylists: 'EgeKAQQoAEABagoQAxAEEAoQCRAF',
} as const;

export type MusicSearchFilter = keyof typeof MUSIC_SEARCH_FILTERS;

function parseSearchResponse(data: any): SearchResultPage {
  // Réponse directe : étagères par onglet ; continuation : musicShelfContinuation.
  const shelfContinuation = data?.continuationContents?.musicShelfContinuation;
  const shelves = shelfContinuation
    ? [shelfContinuation]
    : findAll(data, 'musicShelfRenderer');

  const items: YTItem[] = [];
  let continuation: string | null = null;
  for (const shelf of shelves) {
    for (const c of shelf?.contents ?? []) {
      const parsed = parseListItem(c?.musicResponsiveListItemRenderer);
      if (parsed) items.push(parsed);
    }
    continuation ??=
      shelf?.continuations?.[0]?.nextContinuationData?.continuation ?? null;
  }
  return { items, continuation };
}

export async function searchMusic(
  query: string,
  filter: MusicSearchFilter,
): Promise<SearchResultPage> {
  const data = await musicPost('search', { query, params: MUSIC_SEARCH_FILTERS[filter] });
  return parseSearchResponse(data);
}

export async function searchMusicContinuation(continuation: string): Promise<SearchResultPage> {
  const data = await musicPost('search', { continuation });
  return parseSearchResponse(data);
}

export async function getMusicSearchSuggestions(query: string): Promise<string[]> {
  const data = await musicPost('music/get_search_suggestions', { input: query });
  const out: string[] = [];
  for (const r of findAll(data, 'searchSuggestionRenderer')) {
    const text = joinRuns(r?.suggestion);
    if (text) out.push(text);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Album (browseId MPRE...)

export async function getAlbumPage(browseId: string): Promise<AlbumPageData> {
  const data = await musicPost('browse', { browseId });

  // Mise en page actuelle : twoColumnBrowseResultsRenderer avec
  // musicResponsiveHeaderRenderer ; on retombe sur musicDetailHeaderRenderer
  // (ancienne mise en page) si besoin.
  const header =
    findFirst(data, 'musicResponsiveHeaderRenderer') ??
    findFirst(data, 'musicDetailHeaderRenderer');
  if (!header) throw new Error('Album introuvable');

  const title = joinRuns(header.title) ?? '';
  const subtitleRuns: any[] = header.subtitle?.runs ?? [];
  const year =
    subtitleRuns.map((r: any) => r?.text?.trim?.() ?? '').find((t: string) => /^\d{4}$/.test(t)) ??
    null;

  // Artistes : straplineTextOne (nouvelle mise en page) ou runs cliquables du
  // sous-titre (ancienne).
  const artistSource = header.straplineTextOne ?? header.subtitle;
  const artists: ArtistRun[] = (artistSource?.runs ?? [])
    .filter((r: any) => (r?.text ?? '').trim() && r.text.trim() !== '•')
    .map((r: any) => ({
      name: r.text.trim(),
      id: r?.navigationEndpoint?.browseEndpoint?.browseId ?? null,
    }))
    .filter((a: ArtistRun) => a.id !== null || (artistSource === header.straplineTextOne));

  const playlistId = findFirst(data, 'watchPlaylistEndpoint')?.playlistId ??
    findFirst(data, 'watchEndpoint')?.playlistId ?? null;

  const shelf = findFirst(data, 'musicShelfRenderer');
  const songs: YTSong[] = [];
  for (const c of shelf?.contents ?? []) {
    const parsed = parseListItem(c?.musicResponsiveListItemRenderer);
    if (parsed?.type === 'song') songs.push(parsed);
  }

  const thumbnail =
    lastThumbnail(header.thumbnail) || lastThumbnail(findFirst(data, 'musicThumbnailRenderer'));

  // Les rangées d'un album n'ont souvent ni pochette ni artiste propres : on
  // complète avec ceux de l'album pour obtenir des YTSong autonomes.
  const filledSongs = songs.map((s) => ({
    ...s,
    thumbnail: s.thumbnail || thumbnail,
    artists: s.artists.length > 0 ? s.artists : artists,
    album: s.album ?? { name: title, id: browseId },
  }));

  return {
    browseId,
    playlistId,
    title,
    artists,
    year,
    subtitle: joinRuns(header.subtitle),
    secondSubtitle: joinRuns(header.secondSubtitle),
    thumbnail,
    songs: filledSongs,
  };
}

// ---------------------------------------------------------------------------
// Artiste (browseId UC...)

function watchEndpointData(endpoint: any): WatchEndpointData | null {
  const watch = endpoint?.watchEndpoint ?? endpoint?.watchPlaylistEndpoint;
  if (!watch) return null;
  return {
    videoId: watch.videoId ?? null,
    playlistId: watch.playlistId ?? null,
    params: watch.params ?? null,
  };
}

export async function getArtistPage(browseId: string): Promise<ArtistPageData> {
  const data = await musicPost('browse', { browseId });

  const immersive = findFirst(data, 'musicImmersiveHeaderRenderer');
  const visual = findFirst(data, 'musicVisualHeaderRenderer');
  const header = immersive ?? visual;
  const name = joinRuns(header?.title) ?? '';
  if (!name) throw new Error('Artiste introuvable');

  const { contents } = sectionListOf(data);

  // Étagère "Titres" : premières chansons populaires + endpoint "Voir tout"
  // (une playlist VL... avec tous les titres).
  let songs: YTSong[] = [];
  let songsMoreBrowseId: string | null = null;
  for (const content of contents) {
    const shelf = content?.musicShelfRenderer;
    if (!shelf) continue;
    const parsed = (shelf.contents ?? [])
      .map((c: any) => parseListItem(c?.musicResponsiveListItemRenderer))
      .filter((i: YTItem | null): i is YTSong => i?.type === 'song');
    if (parsed.length > 0) {
      songs = parsed;
      songsMoreBrowseId = shelf.bottomEndpoint?.browseEndpoint?.browseId ?? null;
      break;
    }
  }

  const sections = parseSections(contents).filter((s) => s.items.length > 0);

  return {
    browseId,
    name,
    description: joinRuns(immersive?.description) ?? null,
    thumbnail:
      lastThumbnail(immersive?.thumbnail) ||
      lastThumbnail(visual?.foregroundThumbnail) ||
      lastThumbnail(visual?.thumbnail),
    subscribers: joinRuns(immersive?.subscriptionButton?.subscribeButtonRenderer?.subscriberCountText) ?? null,
    shuffleEndpoint: watchEndpointData(immersive?.playButton?.buttonRenderer?.navigationEndpoint),
    radioEndpoint: watchEndpointData(immersive?.startRadioButton?.buttonRenderer?.navigationEndpoint),
    songs,
    songsMoreBrowseId,
    sections,
  };
}

/** Page "Voir tout" d'une section artiste (albums, singles...). */
export async function getArtistItems(browseId: string, params?: string): Promise<ArtistItemsPage> {
  const data = await musicPost('browse', { browseId, ...(params ? { params } : {}) });
  const title =
    joinRuns(findFirst(data, 'musicHeaderRenderer')?.title) ??
    joinRuns(data?.header?.musicHeaderRenderer?.title) ??
    '';

  const items: YTItem[] = [];
  const grid = findFirst(data, 'gridRenderer');
  for (const item of grid?.items ?? []) {
    const parsed = parseTwoRowItem(item?.musicTwoRowItemRenderer);
    if (parsed) items.push(parsed);
  }
  if (items.length === 0) {
    // Certaines sections "voir tout" (titres) sont des listes, pas des grilles.
    for (const r of findAll(data, 'musicResponsiveListItemRenderer')) {
      const parsed = parseListItem(r);
      if (parsed) items.push(parsed);
    }
  }
  return { title, items };
}

// ---------------------------------------------------------------------------
// Playlist (browseId VL<playlistId>)

function parsePlaylistSongs(container: any): { songs: YTSong[]; continuation: string | null } {
  const songs: YTSong[] = [];
  for (const c of container?.contents ?? []) {
    const parsed = parseListItem(c?.musicResponsiveListItemRenderer);
    if (parsed?.type === 'song') songs.push(parsed);
  }
  const continuation =
    container?.continuations?.[0]?.nextContinuationData?.continuation ??
    container?.contents?.find((c: any) => c?.continuationItemRenderer)
      ?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token ??
    null;
  return { songs, continuation };
}

export async function getPlaylistPage(playlistId: string): Promise<PlaylistPageData> {
  const browseId = playlistId.startsWith('VL') ? playlistId : `VL${playlistId}`;
  const data = await musicPost('browse', { browseId });

  const header =
    findFirst(data, 'musicResponsiveHeaderRenderer') ??
    findFirst(data, 'musicDetailHeaderRenderer') ??
    findFirst(data, 'musicEditablePlaylistDetailHeaderRenderer');
  const shelf =
    findFirst(data, 'musicPlaylistShelfRenderer') ?? findFirst(data, 'musicShelfRenderer');
  const { songs, continuation } = parsePlaylistSongs(shelf);

  const authorRuns: any[] = (header?.straplineTextOne ?? header?.subtitle)?.runs ?? [];
  const author =
    authorRuns
      .map((r: any) => r?.text?.trim?.() ?? '')
      .filter((t: string) => t && t !== '•')
      .find((t: string) => !/^\d/.test(t)) ?? null;

  return {
    browseId,
    playlistId: browseId.replace(/^VL/, ''),
    title: joinRuns(header?.title) ?? '',
    author,
    subtitle: joinRuns(header?.subtitle),
    secondSubtitle: joinRuns(header?.secondSubtitle),
    thumbnail:
      lastThumbnail(header?.thumbnail) || lastThumbnail(findFirst(data, 'musicThumbnailRenderer')),
    songs,
    continuation,
  };
}

export async function getPlaylistContinuation(
  continuation: string,
): Promise<{ songs: YTSong[]; continuation: string | null }> {
  const data = await musicPost('browse', { continuation });
  const cont =
    data?.continuationContents?.musicPlaylistShelfContinuation ??
    data?.continuationContents?.musicShelfContinuation;
  if (cont) return parsePlaylistSongs(cont);
  // Nouvelle forme : onResponseReceivedActions -> appendContinuationItemsAction.
  const appended = findFirst(data, 'appendContinuationItemsAction');
  return parsePlaylistSongs({ contents: appended?.continuationItems ?? [] });
}

// ---------------------------------------------------------------------------
// File "à suivre" / radio (endpoint next, comme YouTubeQueue de Metrolist)

export interface MusicQueue {
  title: string | null;
  songs: YTSong[];
  /** Endpoint automix à suivre pour prolonger la file (radio infinie). */
  automix: WatchEndpointData | null;
}

async function nextInternal(body: Record<string, unknown>): Promise<MusicQueue> {
  const data = await musicPost('next', body);
  const panel = findFirst(data, 'playlistPanelRenderer');
  const songs: YTSong[] = [];
  for (const c of panel?.contents ?? []) {
    const parsed = parseQueueItem(c?.playlistPanelVideoRenderer);
    if (parsed) songs.push(parsed);
  }
  const automixEndpoint = findFirst(data, 'automixPreviewVideoRenderer');
  return {
    title: joinRuns(findFirst(data, 'musicQueueHeaderRenderer')?.subtitle) ?? null,
    songs,
    automix: watchEndpointData(
      findFirst(automixEndpoint, 'navigationEndpoint') ?? null,
    ),
  };
}

/**
 * File YouTube Music pour une chanson ou une playlist : mêmes suggestions que
 * le bouton "Lecture" de music.youtube.com. Si la réponse ne contient qu'un
 * aperçu automix (cas d'une chanson seule), on suit l'endpoint automix pour
 * obtenir la vraie file, comme Metrolist.
 */
export async function getMusicQueue(options: {
  videoId?: string;
  playlistId?: string;
  params?: string;
}): Promise<MusicQueue> {
  const body: Record<string, unknown> = {};
  if (options.videoId) body.videoId = options.videoId;
  if (options.playlistId) body.playlistId = options.playlistId;
  if (options.params) body.params = options.params;
  const first = await nextInternal(body);
  if (first.automix?.playlistId) {
    const auto = await nextInternal({
      playlistId: first.automix.playlistId,
      ...(first.automix.params ? { params: first.automix.params } : {}),
    });
    const seen = new Set(first.songs.map((s) => s.id));
    return {
      title: first.title ?? auto.title,
      songs: [...first.songs, ...auto.songs.filter((s) => !seen.has(s.id))],
      automix: auto.automix,
    };
  }
  return first;
}

/** Radio d'un titre (playlist RDAMVM<videoId>) : la file du mode radio. */
export async function getMusicRadioQueue(videoId: string): Promise<YTSong[]> {
  const queue = await getMusicQueue({ videoId, playlistId: `RDAMVM${videoId}` });
  return queue.songs;
}

// ---------------------------------------------------------------------------
// Explorer : nouveautés, moods & genres, charts

export async function getNewReleaseAlbums(): Promise<YTAlbum[]> {
  const data = await musicPost('browse', { browseId: 'FEmusic_new_releases_albums' });
  const grid = findFirst(data, 'gridRenderer');
  const albums: YTAlbum[] = [];
  for (const item of grid?.items ?? []) {
    const parsed = parseTwoRowItem(item?.musicTwoRowItemRenderer);
    if (parsed?.type === 'album') albums.push(parsed);
  }
  return albums;
}

export async function getMoodAndGenres(): Promise<MoodSection[]> {
  const data = await musicPost('browse', { browseId: 'FEmusic_moods_and_genres' });
  const { contents } = sectionListOf(data);
  return parseMoodSections(contents);
}

/** Page d'une catégorie mood/genre : sections de playlists. */
export async function getMoodPage(
  browseId: string,
  params?: string,
): Promise<{ title: string; sections: MusicSection[] }> {
  const data = await musicPost('browse', { browseId, ...(params ? { params } : {}) });
  const { contents } = sectionListOf(data);
  return {
    title:
      joinRuns(data?.header?.musicHeaderRenderer?.title) ??
      joinRuns(findFirst(data, 'musicHeaderRenderer')?.title) ??
      '',
    sections: parseSections(contents),
  };
}

export async function getCharts(): Promise<MusicSection[]> {
  const data = await musicPost('browse', { browseId: 'FEmusic_charts' });
  const { contents } = sectionListOf(data);
  return parseSections(contents);
}

// ---------------------------------------------------------------------------
// Résolutions par nom (compatibilité avec les anciens écrans Deezer)

/** Premier artiste YouTube Music correspondant à un nom. */
export async function findArtistByName(name: string): Promise<string | null> {
  const { items } = await searchMusic(name, 'artists');
  const artist = items.find((i) => i.type === 'artist');
  return artist && artist.type === 'artist' ? artist.browseId : null;
}

/** Meilleur album YouTube Music pour "artiste + titre" (fil Nouveautés legacy). */
export async function findAlbumByName(artist: string, title: string): Promise<string | null> {
  const { items } = await searchMusic(`${artist} ${title}`, 'albums');
  const album = items.find((i) => i.type === 'album');
  return album && album.type === 'album' ? album.browseId : null;
}
