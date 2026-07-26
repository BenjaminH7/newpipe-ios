// Parseurs des renderers InnerTube de YouTube Music (WEB_REMIX) vers le
// modèle de src/api/ytmusic/types.ts. Même rôle que les data classes
// models/Music*Renderer.kt de Metrolist, mais en navigation JSON tolérante :
// on ne modélise que ce qu'on lit, tout le reste est optionnel.
import type {
  ArtistRun,
  MoodCategory,
  MoodSection,
  MusicSection,
  YTItem,
  YTSong,
} from './types';

// ---------------------------------------------------------------------------
// Utilitaires génériques

/** Cherche récursivement toutes les occurrences de `key` dans un JSON imbriqué. */
export function findAll(obj: unknown, key: string, out: any[] = []): any[] {
  if (Array.isArray(obj)) {
    for (const item of obj) findAll(item, key, out);
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === key) out.push(v);
      else findAll(v, key, out);
    }
  }
  return out;
}

export function findFirst(obj: unknown, key: string): any {
  return findAll(obj, key)[0] ?? null;
}

interface RawRun {
  text?: string;
  navigationEndpoint?: any;
}

function runsOf(node: any): RawRun[] {
  return Array.isArray(node?.runs) ? node.runs : [];
}

export function joinRuns(node: any): string | null {
  const runs = runsOf(node);
  if (runs.length === 0) return typeof node?.simpleText === 'string' ? node.simpleText : null;
  return runs.map((r) => r.text ?? '').join('');
}

function firstRunText(node: any): string {
  return runsOf(node)[0]?.text ?? node?.simpleText ?? '';
}

function browseIdOf(endpoint: any): string | null {
  return endpoint?.browseEndpoint?.browseId ?? null;
}

function pageTypeOf(endpoint: any): string | null {
  return (
    endpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig
      ?.pageType ?? null
  );
}

export function parseDurationText(text: string | null | undefined): number {
  if (!text) return -1;
  const parts = text.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.length < 2 || parts.some((p) => Number.isNaN(p))) return -1;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function thumbnailsOf(node: any): { url?: string }[] {
  // Couvre thumbnail.musicThumbnailRenderer.thumbnail.thumbnails,
  // thumbnailRenderer.musicThumbnailRenderer..., et thumbnail.thumbnails.
  const direct = node?.thumbnails;
  if (Array.isArray(direct)) return direct;
  const found = findAll(node, 'thumbnails').find((t) => Array.isArray(t));
  return Array.isArray(found) ? found : [];
}

export function lastThumbnail(node: any): string {
  const thumbs = thumbnailsOf(node);
  return thumbs[thumbs.length - 1]?.url ?? '';
}

/**
 * Les pochettes YouTube Music sont servies à la taille demandée dans l'URL
 * ("=w120-h120-..."). Pour un hero plein écran on redemande la même image en
 * plus grand plutôt que d'étirer la vignette.
 */
export function resizeThumbnail(url: string, size: number): string {
  if (!url) return url;
  return url.replace(/=w\d+-h\d+/, `=w${size}-h${size}`);
}

function hasExplicitBadge(badges: any): boolean {
  if (!Array.isArray(badges)) return false;
  return badges.some(
    (b) => b?.musicInlineBadgeRenderer?.icon?.iconType === 'MUSIC_EXPLICIT_BADGE',
  );
}

const YEAR_RE = /^\d{4}$/;
const DURATION_RE = /^\d+:\d{2}(:\d{2})?$/;

/**
 * Découpe les runs d'un sous-titre ("Artiste A, Artiste B • Album • 3:42")
 * en artistes / album / durée / année, en s'appuyant d'abord sur les
 * browseIds (fiable quelle que soit la langue), puis sur la forme du texte.
 */
function splitSubtitleRuns(runs: RawRun[]): {
  artists: ArtistRun[];
  album: { name: string; id: string } | null;
  duration: number;
  year: string | null;
} {
  const artists: ArtistRun[] = [];
  let album: { name: string; id: string } | null = null;
  let duration = -1;
  let year: string | null = null;

  for (const run of runs) {
    const text = (run.text ?? '').trim();
    if (!text || text === '•' || text === '&' || text === ',') continue;
    const browseId = browseIdOf(run.navigationEndpoint);
    const pageType = pageTypeOf(run.navigationEndpoint);
    if (browseId?.startsWith('MPRE') || pageType === 'MUSIC_PAGE_TYPE_ALBUM') {
      album = { name: text, id: browseId ?? '' };
    } else if (browseId?.startsWith('UC') || pageType === 'MUSIC_PAGE_TYPE_ARTIST') {
      artists.push({ name: text, id: browseId });
    } else if (DURATION_RE.test(text)) {
      duration = parseDurationText(text);
    } else if (YEAR_RE.test(text)) {
      year = text;
    }
  }
  return { artists, album, duration, year };
}

/** Artistes "au mieux" quand aucun run n'est cliquable : premier segment avant "•". */
function fallbackArtists(runs: RawRun[]): ArtistRun[] {
  const joined = runs.map((r) => r.text ?? '').join('');
  const firstSegment = joined.split('•')[0]?.trim();
  if (!firstSegment) return [];
  return firstSegment
    .split(/,|&/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name, id: null }));
}

// ---------------------------------------------------------------------------
// musicResponsiveListItemRenderer : rangée de liste (recherche, album,
// playlist, titres populaires d'un artiste...)

export function parseListItem(r: any): YTItem | null {
  if (!r) return null;
  const flexColumns: any[] = Array.isArray(r.flexColumns) ? r.flexColumns : [];
  const columns = flexColumns.map(
    (c) => c?.musicResponsiveListItemFlexColumnRenderer?.text ?? null,
  );
  const title = firstRunText(columns[0]);
  if (!title) return null;

  const titleRunEndpoint = runsOf(columns[0])[0]?.navigationEndpoint;
  const videoId =
    r.playlistItemData?.videoId ??
    titleRunEndpoint?.watchEndpoint?.videoId ??
    findFirst(r.overlay, 'watchEndpoint')?.videoId ??
    null;

  const thumbnail = lastThumbnail(r.thumbnail);

  if (videoId) {
    // Runs secondaires : selon la page, artistes/album/durée sont répartis
    // sur une ou plusieurs colonnes — on agrège tout.
    const secondaryRuns = columns.slice(1).flatMap(runsOf);
    const { artists, album, duration } = splitSubtitleRuns(secondaryRuns);
    const fixedDuration = parseDurationText(
      joinRuns(r.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text),
    );
    return {
      type: 'song',
      id: videoId,
      title,
      artists: artists.length > 0 ? artists : fallbackArtists(secondaryRuns),
      album,
      duration: fixedDuration >= 0 ? fixedDuration : duration,
      thumbnail,
      explicit: hasExplicitBadge(r.badges),
    };
  }

  const browseId = browseIdOf(r.navigationEndpoint);
  if (!browseId) return null;
  const pageType = pageTypeOf(r.navigationEndpoint);
  const secondaryRuns = columns.slice(1).flatMap(runsOf);
  const subtitle = columns[1] ? joinRuns(columns[1]) : null;

  if (pageType === 'MUSIC_PAGE_TYPE_ARTIST' || (browseId.startsWith('UC') && !pageType)) {
    return { type: 'artist', browseId, name: title, thumbnail, subtitle };
  }
  if (pageType === 'MUSIC_PAGE_TYPE_ALBUM' || browseId.startsWith('MPRE')) {
    const { artists, year } = splitSubtitleRuns(secondaryRuns);
    return {
      type: 'album',
      browseId,
      playlistId: findFirst(r.overlay ?? r.menu, 'watchPlaylistEndpoint')?.playlistId ?? null,
      title,
      artists: artists.length > 0 ? artists : fallbackArtists(secondaryRuns),
      year,
      thumbnail,
      explicit: hasExplicitBadge(r.badges),
    };
  }
  if (
    pageType === 'MUSIC_PAGE_TYPE_PLAYLIST' ||
    pageType === 'MUSIC_PAGE_TYPE_AUDIOBOOK' ||
    browseId.startsWith('VL')
  ) {
    const playlistId = browseId.replace(/^VL/, '');
    return {
      type: 'playlist',
      browseId: browseId.startsWith('VL') ? browseId : `VL${playlistId}`,
      playlistId,
      title,
      author: fallbackArtists(secondaryRuns)[0]?.name ?? null,
      subtitle,
      thumbnail,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// musicTwoRowItemRenderer : carte carrée/ronde (carrousels, grilles)

export function parseTwoRowItem(r: any): YTItem | null {
  if (!r) return null;
  const title = firstRunText(r.title);
  const nav = r.navigationEndpoint ?? runsOf(r.title)[0]?.navigationEndpoint;
  if (!title || !nav) return null;
  const thumbnail = lastThumbnail(r.thumbnailRenderer);
  const subtitleRuns = runsOf(r.subtitle);
  const subtitle = joinRuns(r.subtitle);

  const watch = nav.watchEndpoint;
  if (watch?.videoId) {
    const { artists, album, duration } = splitSubtitleRuns(subtitleRuns);
    return {
      type: 'song',
      id: watch.videoId,
      title,
      artists: artists.length > 0 ? artists : fallbackArtists(subtitleRuns),
      album,
      duration,
      thumbnail,
      explicit: hasExplicitBadge(r.subtitleBadges),
    };
  }

  const browseId = browseIdOf(nav);
  if (!browseId) return null;
  const pageType = pageTypeOf(nav);

  if (pageType === 'MUSIC_PAGE_TYPE_ARTIST' || (!pageType && browseId.startsWith('UC'))) {
    return { type: 'artist', browseId, name: title, thumbnail, subtitle };
  }
  if (pageType === 'MUSIC_PAGE_TYPE_ALBUM' || browseId.startsWith('MPRE')) {
    const { artists, year } = splitSubtitleRuns(subtitleRuns);
    return {
      type: 'album',
      browseId,
      playlistId: findFirst(r.thumbnailOverlay, 'watchPlaylistEndpoint')?.playlistId ?? null,
      title,
      artists: artists.length > 0 ? artists : fallbackArtists(subtitleRuns),
      year,
      thumbnail,
      explicit: hasExplicitBadge(r.subtitleBadges),
    };
  }
  if (pageType === 'MUSIC_PAGE_TYPE_PLAYLIST' || browseId.startsWith('VL')) {
    const playlistId = browseId.replace(/^VL/, '');
    return {
      type: 'playlist',
      browseId: browseId.startsWith('VL') ? browseId : `VL${playlistId}`,
      playlistId,
      title,
      author: subtitle,
      subtitle,
      thumbnail,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// musicMultiRowListItemRenderer : rangée d'épisode (podcasts). L'accueil filtré
// par le chip "Podcasts" ne renvoie que ce renderer : sans lui, la page revient
// entièrement vide. Un épisode se lit comme un titre ordinaire (videoId).

export function parseMultiRowItem(r: any): YTSong | null {
  if (!r) return null;
  const videoId = r.onTap?.watchEndpoint?.videoId ?? null;
  const title = firstRunText(r.title);
  if (!videoId || !title) return null;
  // secondTitle = nom de l'émission, subtitle = date de publication. Le
  // browseId de l'émission est un MPSPPL... (page podcast), pas une chaîne :
  // on ne le garde que s'il pointe vraiment vers un artiste, sinon "aller à
  // l'artiste" ouvrirait une page introuvable.
  const showRuns = runsOf(r.secondTitle);
  const show = showRuns[0]?.text?.trim();
  const showId = browseIdOf(showRuns[0]?.navigationEndpoint);
  return {
    type: 'song',
    id: videoId,
    title,
    artists: show ? [{ name: show, id: showId?.startsWith('UC') ? showId : null }] : [],
    album: null,
    duration: -1,
    thumbnail: lastThumbnail(r.thumbnail),
    explicit: false,
  };
}

// ---------------------------------------------------------------------------
// playlistPanelVideoRenderer : entrée de file de lecture (endpoint next)

export function parseQueueItem(r: any): YTSong | null {
  if (!r?.videoId) return null;
  const bylineRuns = [...runsOf(r.longBylineText), ...runsOf(r.shortBylineText)];
  const { artists, album } = splitSubtitleRuns(runsOf(r.longBylineText));
  return {
    type: 'song',
    id: r.videoId,
    title: firstRunText(r.title),
    artists: artists.length > 0 ? artists : fallbackArtists(bylineRuns),
    album,
    duration: parseDurationText(joinRuns(r.lengthText)),
    thumbnail: lastThumbnail(r.thumbnail),
    explicit: hasExplicitBadge(r.badges),
  };
}

// ---------------------------------------------------------------------------
// Sections (carrousels / étagères / grilles)

function parseShelfItems(contents: any[]): YTItem[] {
  const items: YTItem[] = [];
  for (const c of contents ?? []) {
    const parsed =
      parseTwoRowItem(c?.musicTwoRowItemRenderer) ??
      parseListItem(c?.musicResponsiveListItemRenderer) ??
      parseMultiRowItem(c?.musicMultiRowListItemRenderer);
    if (parsed) items.push(parsed);
  }
  return items;
}

/**
 * Convertit le contenu d'un sectionListRenderer en sections homogènes.
 * Couvre musicCarouselShelfRenderer (accueil, pages artiste, charts, moods),
 * musicShelfRenderer (listes) et gridRenderer (grilles "voir tout").
 */
export function parseSections(sectionContents: any[]): MusicSection[] {
  const sections: MusicSection[] = [];
  for (const content of sectionContents ?? []) {
    const carousel = content?.musicCarouselShelfRenderer;
    if (carousel) {
      const header = carousel.header?.musicCarouselShelfBasicHeaderRenderer;
      const more = header?.moreContentButton?.buttonRenderer?.navigationEndpoint?.browseEndpoint;
      const items = parseShelfItems(carousel.contents);
      if (items.length > 0) {
        sections.push({
          title: firstRunText(header?.title),
          subtitle: joinRuns(header?.strapline),
          items,
          moreBrowseId: more?.browseId ?? null,
          moreParams: more?.params ?? null,
        });
      }
      continue;
    }
    const shelf = content?.musicShelfRenderer;
    if (shelf) {
      const more = shelf.bottomEndpoint?.browseEndpoint;
      const items = parseShelfItems(shelf.contents);
      if (items.length > 0) {
        sections.push({
          title: joinRuns(shelf.title) ?? '',
          subtitle: null,
          items,
          moreBrowseId: more?.browseId ?? null,
          moreParams: more?.params ?? null,
        });
      }
      continue;
    }
    const grid = content?.gridRenderer;
    if (grid) {
      const items = parseShelfItems(grid.items);
      if (items.length > 0) {
        sections.push({
          title: firstRunText(grid.header?.gridHeaderRenderer?.title),
          subtitle: null,
          items,
          moreBrowseId: null,
          moreParams: null,
        });
      }
    }
  }
  return sections;
}

// ---------------------------------------------------------------------------
// Moods & genres (musicNavigationButtonRenderer)

function argbToHex(value: unknown): string | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  // Couleur ARGB signée 32 bits -> "#rrggbb".
  return `#${(n >>> 0 & 0xffffff).toString(16).padStart(6, '0')}`;
}

export function parseMoodSections(sectionContents: any[]): MoodSection[] {
  const sections: MoodSection[] = [];
  for (const content of sectionContents ?? []) {
    const grid = content?.gridRenderer;
    if (!grid) continue;
    const categories: MoodCategory[] = [];
    for (const item of grid.items ?? []) {
      const button = item?.musicNavigationButtonRenderer;
      const browse = button?.clickCommand?.browseEndpoint;
      if (!button || !browse?.browseId) continue;
      categories.push({
        title: firstRunText(button.buttonText),
        browseId: browse.browseId,
        params: browse.params ?? null,
        color: argbToHex(button.solid?.leftStripeColor),
      });
    }
    if (categories.length > 0) {
      sections.push({ title: firstRunText(grid.header?.gridHeaderRenderer?.title), categories });
    }
  }
  return sections;
}
