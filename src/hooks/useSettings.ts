import { useEffect, useState } from 'react';
import {
  getSettingsSync,
  loadSettings,
  setMusicQuotaMinutes,
  setSkipProductPlacements,
  setTextOnlyMode,
  setThemeMode,
  setVideoQuotaMinutes,
  subscribeSettings,
  type ThemeMode,
} from '@/storage/settings';

export function useSkipProductPlacements(): [boolean, (value: boolean) => void] {
  const [enabled, setEnabled] = useState(getSettingsSync().skipProductPlacements);

  useEffect(() => {
    loadSettings().then((s) => setEnabled(s.skipProductPlacements));
    return subscribeSettings((s) => setEnabled(s.skipProductPlacements));
  }, []);

  return [enabled, setSkipProductPlacements];
}

export function useTextOnlyMode(): [boolean, (value: boolean) => void] {
  const [enabled, setEnabled] = useState(getSettingsSync().textOnlyMode);

  useEffect(() => {
    loadSettings().then((s) => setEnabled(s.textOnlyMode));
    return subscribeSettings((s) => setEnabled(s.textOnlyMode));
  }, []);

  return [enabled, setTextOnlyMode];
}

export function useThemeMode(): [ThemeMode, (value: ThemeMode) => void] {
  const [mode, setMode] = useState(getSettingsSync().themeMode);

  useEffect(() => {
    loadSettings().then((s) => setMode(s.themeMode));
    return subscribeSettings((s) => setMode(s.themeMode));
  }, []);

  return [mode, setThemeMode];
}
