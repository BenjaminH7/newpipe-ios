const compactNumber = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const fullNumber = new Intl.NumberFormat('fr-FR');

export function formatViews(views: number): string {
  if (views < 0) return '';
  return `${compactNumber.format(views)} vues`;
}

export function formatCount(n: number): string {
  if (n < 0) return '';
  return compactNumber.format(n);
}

export function formatFullCount(n: number): string {
  if (n < 0) return '';
  return fullNumber.format(n);
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 0) return 'LIVE';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

/** Durée cumulée d'une playlist, façon Spotify : « 12 min », « 1 h 12 ». */
export function formatTotalDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

export function formatUploadDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export function formatRelativeTime(timestamp: number): string {
  const diffSeconds = Math.max(0, (Date.now() - timestamp) / 1000);
  if (diffSeconds < 60) return "À l'instant";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} j`;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(timestamp),
  );
}
