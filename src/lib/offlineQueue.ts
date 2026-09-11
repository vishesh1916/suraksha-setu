// ============================================================
// Suraksha Setu — Offline Report Sync Queue
// Automatically stores reports when offline & syncs on reconnect
// ============================================================

export interface OfflineReportItem {
  localId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
}

const STORAGE_KEY = 'suraksha_offline_reports_queue';

export function getOfflineQueue(): OfflineReportItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineReport(payload: Record<string, unknown>): string {
  const localId = `OFFLINE_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const item: OfflineReportItem = {
    localId,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };

  const queue = getOfflineQueue();
  queue.push(item);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {}

  return localId;
}

export function removeOfflineReport(localId: string): void {
  const queue = getOfflineQueue().filter((item) => item.localId !== localId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {}
}

export async function flushOfflineQueue(
  onSuccess?: (localId: string, serverId: string) => void
): Promise<{ synced: number; failed: number }> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });

      if (res.ok) {
        const data = await res.json();
        removeOfflineReport(item.localId);
        synced++;
        if (onSuccess && data?.data?.id) {
          onSuccess(item.localId, data.data.id);
        }
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

// Auto-register listener in browser
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushOfflineQueue();
  });
}
