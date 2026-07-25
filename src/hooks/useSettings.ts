import { useEffect, useState } from 'react';
import {
  getSettingsSync,
  loadSettings,
  setSkipProductPlacements,
  subscribeSettings,
} from '@/storage/settings';

export function useSkipProductPlacements(): [boolean, (value: boolean) => void] {
  const [enabled, setEnabled] = useState(getSettingsSync().skipProductPlacements);

  useEffect(() => {
    loadSettings().then((s) => setEnabled(s.skipProductPlacements));
    return subscribeSettings((s) => setEnabled(s.skipProductPlacements));
  }, []);

  return [enabled, setSkipProductPlacements];
}
