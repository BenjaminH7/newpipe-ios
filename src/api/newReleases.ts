// Détection des nouvelles sorties des artistes suivis : pour chaque artiste,
// on recharge sa discographie Deezer et on la compare aux albums déjà connus
// (diff sur les ids, voir src/storage/followedArtists.ts). Lancée au démarrage,
// au retour de l'app au premier plan (throttlée) et en pull-to-refresh sur
// l'écran Nouveautés. Pas de tâche de fond native : Expo Go ne les exécute pas
// de façon fiable, le retour au premier plan est le meilleur signal disponible
// sans build custom.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getArtistAlbums } from '@/api/deezer';
import {
  loadFollowedArtists,
  recordKnownAlbums,
  type FollowedArtist,
} from '@/storage/followedArtists';
import { addReleases, type ReleaseFeedItem } from '@/storage/releasesFeed';

const LAST_CHECK_KEY = '@youtubeclient/releasesLastCheck';

// Entre deux passages au premier plan rapprochés, inutile de re-frapper
// Deezer : les sorties arrivent à l'échelle de la journée, pas de la minute.
const MIN_CHECK_INTERVAL_MS = 15 * 60 * 1000;

// Filet de sécurité : si la baseline d'albums a échoué au moment du suivi
// (réseau), le diff verrait toute la discographie comme "nouvelle". On ne
// garde donc que les sorties datées d'après le suivi, avec une semaine de
// marge pour ne pas rater une sortie de la veille.
const FOLLOW_GRACE_MS = 7 * 24 * 3600 * 1000;

// Même limite que la page artiste : baseline et vérifications regardent la
// même fenêtre de discographie, le diff reste cohérent.
const ALBUMS_LIMIT = 30;

let inFlight: Promise<void> | null = null;
let lastCheckAt: number | null = null;

async function getLastCheck(): Promise<number> {
  if (lastCheckAt !== null) return lastCheckAt;
  try {
    const raw = await AsyncStorage.getItem(LAST_CHECK_KEY);
    lastCheckAt = raw ? Number(raw) : 0;
  } catch {
    lastCheckAt = 0;
  }
  return lastCheckAt;
}

async function setLastCheck(timestamp: number): Promise<void> {
  lastCheckAt = timestamp;
  try {
    await AsyncStorage.setItem(LAST_CHECK_KEY, String(timestamp));
  } catch {
    // Sans persistance on re-vérifiera au prochain démarrage, sans gravité.
  }
}

function isReleasedAfter(releaseDate: string, cutoff: number): boolean {
  const time = Date.parse(releaseDate);
  return Number.isFinite(time) && time >= cutoff;
}

async function collectArtistReleases(artist: FollowedArtist): Promise<ReleaseFeedItem[]> {
  const albums = await getArtistAlbums(artist.id, ALBUMS_LIMIT);
  if (albums.length === 0) return [];

  const known = new Set(artist.knownAlbumIds);
  const cutoff = artist.followedAt - FOLLOW_GRACE_MS;
  const unknown = albums.filter((a) => !known.has(a.id));
  if (unknown.length === 0) return [];

  // Tout ce qui a été vu entre au connu, même les sorties trop vieilles pour
  // le fil : on ne re-évaluera pas ces albums à chaque passage.
  await recordKnownAlbums(artist.id, albums.map((a) => a.id));

  const discoveredAt = Date.now();
  return unknown
    .filter((a) => isReleasedAfter(a.releaseDate, cutoff))
    .map((a) => ({
      albumId: a.id,
      artistId: artist.id,
      artistName: artist.name,
      title: a.title,
      coverUrl: a.coverUrl,
      releaseDate: a.releaseDate,
      recordType: a.recordType,
      trackCount: a.trackCount,
      discoveredAt,
      seen: false,
    }));
}

async function doCheck(force: boolean): Promise<void> {
  const artists = await loadFollowedArtists();
  if (artists.length === 0) return;

  if (!force) {
    const last = await getLastCheck();
    if (Date.now() - last < MIN_CHECK_INTERVAL_MS) return;
  }

  const results = await Promise.allSettled(artists.map(collectArtistReleases));
  const newItems = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  if (newItems.length > 0) await addReleases(newItems);
  await setLastCheck(Date.now());
}

// Une seule vérification à la fois : les déclencheurs (démarrage, premier
// plan, pull-to-refresh) peuvent se chevaucher, les appels concurrents
// partagent la promesse en cours.
export function checkForNewReleases(options: { force?: boolean } = {}): Promise<void> {
  if (!inFlight) {
    inFlight = doCheck(options.force ?? false).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
