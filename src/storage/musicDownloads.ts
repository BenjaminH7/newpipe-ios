// Téléchargement du flux audio d'une piste pour lecture hors-ligne : un
// fichier local par piste, sous le répertoire documents de l'app. Utilise
// l'API File/Directory d'expo-file-system (SDK 54), pas l'ancienne API
// FileSystem.downloadAsync.
import { Directory, File, Paths } from 'expo-file-system';

const musicDir = new Directory(Paths.document, 'music');

function ensureMusicDir(): void {
  if (!musicDir.exists) musicDir.create({ intermediates: true, idempotent: true });
}

function trackFile(videoId: string): File {
  return new File(musicDir, `${videoId}.m4a`);
}

export function getLocalAudioUri(videoId: string): string | null {
  const file = trackFile(videoId);
  return file.exists ? file.uri : null;
}

export async function downloadAudioFile(videoId: string, remoteUrl: string): Promise<string> {
  ensureMusicDir();
  const destination = trackFile(videoId);
  if (destination.exists) destination.delete();
  const file = await File.downloadFileAsync(remoteUrl, destination, { idempotent: true });
  return file.uri;
}

export function deleteAudioFile(videoId: string): void {
  const file = trackFile(videoId);
  if (file.exists) file.delete();
}
