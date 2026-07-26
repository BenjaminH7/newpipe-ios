import { useEffect, useState } from 'react';
import {
  getSettingsSync,
  loadSettings,
  setHideSubscriptionsTab,
  setMusicQuotaMinutes,
  setSkipProductPlacements,
  setTextOnlyMode,
  setThemeMode,
  setTranslateLyrics,
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

export function useTranslateLyrics(): [boolean, (value: boolean) => void] {
  const [enabled, setEnabled] = useState(getSettingsSync().translateLyrics);

  useEffect(() => {
    loadSettings().then((s) => setEnabled(s.translateLyrics));
    return subscribeSettings((s) => setEnabled(s.translateLyrics));
  }, []);

  return [enabled, setTranslateLyrics];
}

export function useThemeMode(): [ThemeMode, (value: ThemeMode) => void] {
  const [mode, setMode] = useState(getSettingsSync().themeMode);

  useEffect(() => {
    loadSettings().then((s) => setMode(s.themeMode));
    return subscribeSettings((s) => setMode(s.themeMode));
  }, []);

  return [mode, setThemeMode];
}

export function useVideoQuotaMinutes(): [number, (value: number) => void] {
  const [minutes, setMinutes] = useState(getSettingsSync().videoQuotaMinutes);

  useEffect(() => {
    loadSettings().then((s) => setMinutes(s.videoQuotaMinutes));
    return subscribeSettings((s) => setMinutes(s.videoQuotaMinutes));
  }, []);

  return [minutes, setVideoQuotaMinutes];
}

export function useMusicQuotaMinutes(): [number, (value: number) => void] {
  const [minutes, setMinutes] = useState(getSettingsSync().musicQuotaMinutes);

  useEffect(() => {
    loadSettings().then((s) => setMinutes(s.musicQuotaMinutes));
    return subscribeSettings((s) => setMinutes(s.musicQuotaMinutes));
  }, []);

  return [minutes, setMusicQuotaMinutes];
}

export function useHideSubscriptionsTab(): [boolean, (value: boolean) => void] {
  const [hidden, setHidden] = useState(getSettingsSync().hideSubscriptionsTab);

  useEffect(() => {
    loadSettings().then((s) => setHidden(s.hideSubscriptionsTab));
    return subscribeSettings((s) => setHidden(s.hideSubscriptionsTab));
  }, []);

  return [hidden, setHideSubscriptionsTab];
}
