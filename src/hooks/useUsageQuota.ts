import { useEffect, useState } from 'react';
import { useMusicQuotaMinutes, useVideoQuotaMinutes } from '@/hooks/useSettings';
import { getUsageSync, loadUsage, subscribeUsage } from '@/storage/usageQuota';

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
