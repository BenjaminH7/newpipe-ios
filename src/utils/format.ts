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

export function formatUploadDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
