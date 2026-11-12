import { useEffect, useState } from 'react';

type LoadingAccess = { id: string; expiresAt: string };

export function usePreorderLoadingAccess() {
  const [access, setAccess] = useState<LoadingAccess | null>(null);
  const [expiredAccess, setExpiredAccess] = useState<LoadingAccess | null>(null);
  useEffect(() => {
    if (!access) return;
    const remaining = Date.parse(access.expiresAt) - Date.now();
    const timer = window.setTimeout(() => setExpiredAccess(access), Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [access]);

  const expired = access !== null && access === expiredAccess;
  return {
    setAccess,
    expired,
    loadingAccessId: expired ? undefined : access?.id,
    getCurrentAccessId: () =>
      access && Date.parse(access.expiresAt) > Date.now() ? access.id : undefined,
  };
}
