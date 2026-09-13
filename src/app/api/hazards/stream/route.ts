// ============================================================
// GET /api/hazards/stream — Server-Sent Events (SSE) Live Feed
// Pushes new hazard events and source health updates in real-time
// ============================================================

import { NextRequest } from 'next/server';
import { getUnifiedHazardData } from '@/lib/hazardAdapters/registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Initial payload
        const initialData = await getUnifiedHazardData({ includeCommunity: true, timeRange: '7d' });
        controller.enqueue(
          encoder.encode(`event: init\ndata: ${JSON.stringify(initialData)}\n\n`)
        );

        // Periodic heartbeat & refresh every 30 seconds
        const intervalId = setInterval(async () => {
          try {
            if (request.signal.aborted) {
              clearInterval(intervalId);
              controller.close();
              return;
            }

            const freshData = await getUnifiedHazardData({ includeCommunity: true, timeRange: '7d' });
            controller.enqueue(
              encoder.encode(`event: update\ndata: ${JSON.stringify(freshData)}\n\n`)
            );
          } catch {
            // keep alive
          }
        }, 30000);

        request.signal.addEventListener('abort', () => {
          clearInterval(intervalId);
          controller.close();
        });
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
