// ============================================================
// Suraksha Setu — GDACS Real-Time Disaster Feed Adapter
// Global Disaster Alert and Coordination System (UN / EC)
// Monitors Cyclones, Floods, Earthquakes, and Tsunamis in South Asia
// ============================================================

import { parseStringPromise } from 'xml2js';
import type { UnifiedHazardEvent, HazardAcronym, HazardSeverity, ProviderHealth } from './types';

export async function fetchGdacsDisasters(): Promise<{
  events: UnifiedHazardEvent[];
  health: ProviderHealth;
}> {
  const sourceUrl = 'https://www.gdacs.org/xml/rss.xml';
  const nowIso = new Date().toISOString();

  try {
    const res = await fetch(sourceUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
    });

    if (!res.ok) {
      throw new Error(`GDACS HTTP ${res.status}`);
    }

    const xmlText = await res.text();
    const parsed = await parseStringPromise(xmlText, { explicitArray: false });

    const items = parsed?.rss?.channel?.item;
    const itemList = Array.isArray(items) ? items : items ? [items] : [];

    const southAsiaEvents: UnifiedHazardEvent[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const it of itemList) {
      const title: string = it.title || '';
      const link: string = it.link || 'https://www.gdacs.org';
      const pubDateStr: string = it.pubDate || nowIso;
      const pubDate = new Date(pubDateStr).toISOString();

      // Coordinates from geo:Point or geo:lat / geo:long
      let lat = 0;
      let lng = 0;
      if (it['geo:Point'] && it['geo:Point']['geo:lat'] && it['geo:Point']['geo:long']) {
        lat = parseFloat(it['geo:Point']['geo:lat']);
        lng = parseFloat(it['geo:Point']['geo:long']);
      } else if (it['geo:lat'] && it['geo:long']) {
        lat = parseFloat(it['geo:lat']);
        lng = parseFloat(it['geo:long']);
      }

      // Check coordinates or text relevance to South Asia
      const inBounds = lat >= 0 && lat <= 38.5 && lng >= 58.0 && lng <= 100.0;
      const lowerText = (title + ' ' + (it.description || '')).toLowerCase();
      const mentionsSouthAsia =
        lowerText.includes('india') ||
        lowerText.includes('nepal') ||
        lowerText.includes('bhutan') ||
        lowerText.includes('bangladesh') ||
        lowerText.includes('sri lanka') ||
        lowerText.includes('bay of bengal') ||
        lowerText.includes('arabian sea');

      if (!inBounds && !mentionsSouthAsia) continue;

      // Extract Acronym & Hazard Type
      let acronym: HazardAcronym = 'FL';
      let hazardType = 'FLOOD';
      if (/tropical cyclone|cyclone|typhoon/i.test(title)) {
        acronym = 'TC';
        hazardType = 'TROPICAL_CYCLONE';
      } else if (/earthquake/i.test(title)) {
        acronym = 'EQ';
        hazardType = 'EARTHQUAKE';
      } else if (/flood/i.test(title)) {
        acronym = 'FL';
        hazardType = 'FLOOD';
      } else if (/drought/i.test(title)) {
        acronym = 'DR';
        hazardType = 'DROUGHT';
      } else if (/tsunami/i.test(title)) {
        acronym = 'TS';
        hazardType = 'TSUNAMI';
      }

      // Determine Severity from GDACS alert level
      let severity: HazardSeverity = 'ADVISORY';
      if (/red alert/i.test(title) || /severe/i.test(title)) {
        severity = 'SEVERE';
      } else if (/orange alert/i.test(title) || /warning/i.test(title)) {
        severity = 'WARNING';
      } else if (/green alert/i.test(title) || /watch/i.test(title)) {
        severity = 'WATCH';
      }

      let country = 'South Asia';
      if (lowerText.includes('india')) country = 'India';
      else if (lowerText.includes('nepal')) country = 'Nepal';
      else if (lowerText.includes('bhutan')) country = 'Bhutan';
      else if (lowerText.includes('bangladesh')) country = 'Bangladesh';
      else if (lowerText.includes('sri lanka')) country = 'Sri Lanka';

      southAsiaEvents.push({
        id: `gdacs_${it.guid?._ || it.guid || Math.random().toString(36).substring(2, 9)}`,
        source: 'GDACS (UN / EC)',
        source_url: link,
        hazard_type: hazardType,
        acronym,
        title: title.replace(/^GDACS\s*Alert\s*-\s*/i, '').trim(),
        severity,
        status: 'ACTIVE',
        geometry: {
          type: 'Point',
          coordinates: [lng || 78.96, lat || 20.59],
        },
        country,
        issued_at: pubDate,
        updated_at: pubDate,
        expires_at: new Date(new Date(pubDate).getTime() + 48 * 3600000).toISOString(),
        freshness: 'Synchronized (GDACS Live)',
        confidence: 'HIGH',
        is_official: true,
        is_community_report: false,
        details: {
          safetyGuidance: `International emergency coordinate bulletin issued by GDACS. Consult national disaster management authority protocols and local district advisories.`,
        },
      });
    }

    return {
      events: southAsiaEvents,
      health: {
        id: 'gdacs',
        name: 'GDACS Emergency Coordination System',
        agency: 'United Nations / European Commission Joint Research Centre',
        coverage: 'South Asia & Global Disaster Sentinel',
        status: 'HEALTHY',
        statusMessage: `Active · Synchronized (${southAsiaEvents.length} South Asian events)`,
        lastSuccessAt: nowIso,
        freshness: 'Live (Synchronized)',
        eventCount: southAsiaEvents.length,
        officialFeedUrl: sourceUrl,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return {
      events: [],
      health: {
        id: 'gdacs',
        name: 'GDACS Emergency Coordination System',
        agency: 'United Nations / European Commission Joint Research Centre',
        coverage: 'South Asia & Global Disaster Sentinel',
        status: 'DEGRADED',
        statusMessage: `Feed connection note: ${errorMsg}`,
        lastSuccessAt: nowIso,
        freshness: 'Unavailable',
        eventCount: 0,
        officialFeedUrl: sourceUrl,
      },
    };
  }
}
