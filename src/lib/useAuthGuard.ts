// ============================================================
// Suraksha Setu — Auth Guard Hook for Staff Operations
// ============================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function useAuthGuard() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();

        if (isMounted) {
          if (data && data.authenticated) {
            setAuthenticated(true);
          } else {
            setAuthenticated(false);
            const currentPath = window.location.pathname;
            router.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
          }
        }
      } catch {
        if (isMounted) {
          setAuthenticated(false);
          router.replace('/login');
        }
      }
    }

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return { authenticated };
}
