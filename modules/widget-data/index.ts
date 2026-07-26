// Interface JS du module natif iOS `WidgetData` (voir
// ios/WidgetDataModule.swift). Optionnel : absent d'Expo Go et d'Android, où
// tout se dégrade en no-op.
import { requireOptionalNativeModule } from 'expo-modules-core';

export interface WidgetTrackPayload {
  id: string;
  title: string;
  artist: string;
  artworkFile: string | null;
}

export interface WidgetPayload {
  nowPlaying: WidgetTrackPayload | null;
  isPlaying: boolean;
  recent: WidgetTrackPayload[];
}

interface WidgetDataNativeModule {
  isAvailable: () => boolean;
  sync: (payload: string, artwork: { file: string; url: string }[]) => Promise<void>;
}

const WidgetData = requireOptionalNativeModule<WidgetDataNativeModule>('WidgetData');

export const hasWidgets = WidgetData !== null;

export async function syncWidgets(
  payload: WidgetPayload,
  artwork: { file: string; url: string }[],
): Promise<void> {
  if (!WidgetData) return;
  try {
    await WidgetData.sync(JSON.stringify(payload), artwork);
  } catch {
    // Best-effort : un widget périmé ne doit jamais faire échouer la lecture.
  }
}
