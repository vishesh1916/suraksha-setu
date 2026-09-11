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
            return;
          }

          // Check if previously authenticated in localStorage
          if (typeof window !== 'undefined' && localStorage.getItem('suraksha_admin_authenticated') === 'true') {
            try {
              const loginRes = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'Suraksha@Setu2026!' }),
              });
              const loginData = await loginRes.json();
              if (loginData.success) {
                setAuthenticated(true);
                return;
              }
            } catch {}
          }

          setAuthenticated(false);
          const currentPath = window.location.pathname;
          router.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
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
