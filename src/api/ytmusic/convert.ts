// Pont entre le catalogue YouTube Music (YTSong) et le format de piste commun
// du lecteur et de la bibliothèque (MusicTrack) : un YTSong porte un videoId
// ordinaire, donc la lecture passe par le pipeline existant sans adaptation.
import type { MusicTrack } from '@/storage/musicLibrary';
import type { ArtistRun, YTSong } from './types';

export function artistNames(artists: ArtistRun[]): string {
  return artists.map((a) => a.name).join(', ');
}

export function songToTrack(song: YTSong): MusicTrack {
  return {
    id: song.id,
    title: song.title,
    artist: artistNames(song.artists) || 'YouTube Music',
    coverArtUrl: song.thumbnail,
    duration: song.duration,
    addedAt: Date.now(),
    localUri: null,
    // Convention des pistes de flux (voir radioTrackToMusicTrack) : ce champ
    // n'est consulté que par la bibliothèque, jamais par la lecture.
    downloadStatus: 'downloaded',
  };
}

export function songsToTracks(songs: YTSong[]): MusicTrack[] {
  return songs.map(songToTrack);
}
