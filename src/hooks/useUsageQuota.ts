import { useEffect, useState } from 'react';
import { useMusicQuotaMinutes, useVideoQuotaMinutes } from '@/hooks/useSettings';
import { getUsageSync, loadUsage, subscribeUsage, type UsageState } from '@/storage/usageQuota';

// État complet du temps d'écoute (jour courant + cumuls mensuels), réactif.
export function useUsageStats(): UsageState {
  const [usage, setUsage] = useState(getUsageSync());

  useEffect(() => {
    loadUsage().then(setUsage);
    return subscribeUsage(setUsage);
  }, []);

  return usage;
}

export function useVideoQuotaExceeded(): boolean {
  const [usage, setUsage] = useState(getUsageSync());
  const [limitMinutes] = useVideoQuotaMinutes();

  useEffect(() => {
    loadUsage().then(setUsage);
    return subscribeUsage(setUsage);
  }, []);

  return usage.videoSeconds >= limitMinutes * 60;
}

export function useMusicQuotaExceeded(): boolean {
  const [usage, setUsage] = useState(getUsageSync());
  const [limitMinutes] = useMusicQuotaMinutes();

  useEffect(() => {
    loadUsage().then(setUsage);
    return subscribeUsage(setUsage);
  }, []);

  return usage.musicSeconds >= limitMinutes * 60;
}
