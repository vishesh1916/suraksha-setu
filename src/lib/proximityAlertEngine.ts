/**
 * Proximity Alert & Notification Engine
 * 
 * Tracks citizen geolocation, calculates distance to active alerts and polygons,
 * detects national emergency alerts, and dispatches native browser notifications
 * and device vibrations when a hazard threatens the user's vicinity.
 */

import type { Alert } from '@/types';

export interface UserCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface ProximityMatch {
  alert: Alert;
  isNational: boolean;
  distanceKm: number | null;
  isWithinProximity: boolean;
}

const PROXIMITY_RADIUS_KM = 50; // Alert if within 50 km of local hazard
const SEEN_ALERTS_KEY = 'suraksha_seen_alert_ids';

/**
 * Calculate great-circle distance between two GPS coordinates using Haversine formula (km).
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Extract approximate centroid coordinate from an Alert polygon or fallback coordinates.
 */
export function getAlertCentroid(alert: Alert): { lat: number; lng: number } {
  try {
    if (alert.polygon && alert.polygon.coordinates && alert.polygon.coordinates[0]) {
      const ring = alert.polygon.coordinates[0];
      if (ring.length > 0) {
        let sumLat = 0;
        let sumLng = 0;
        for (const coord of ring) {
          sumLng += coord[0];
          sumLat += coord[1];
        }
        return {
          lat: sumLat / ring.length,
          lng: sumLng / ring.length,
        };
      }
    }
  } catch {}

  // Fallback coordinates for regional centers
  return { lat: 26.8467, lng: 80.9462 };
}

/**
 * Determine if an alert is classified as a National Emergency Alert.
 */
export function isNationalAlert(alert: Alert): boolean {
  if (alert.severity >= 4) return true; // Level 4 (Severe) and Level 5 (Catastrophic)
  const headline = (alert.headline || '').toUpperCase();
  const area = (alert.areaName || '').toUpperCase();
  const src = (alert.source || '').toUpperCase();
  return (
    headline.includes('NATIONAL') ||
    headline.includes('ALL-INDIA') ||
    area.includes('NATIONAL') ||
    area.includes('ALL-INDIA') ||
    src.includes('NDMA_NATIONAL')
  );
}

/**
 * Request user's current GPS location.
 */
export async function getCurrentUserLocation(): Promise<UserCoordinates | null> {
  if (typeof window === 'undefined' || !navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: UserCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        try {
          sessionStorage.setItem('suraksha_user_lat', coords.latitude.toString());
          sessionStorage.setItem('suraksha_user_lng', coords.longitude.toString());
        } catch {}
        resolve(coords);
      },
      () => {
        // Fallback: check session storage if available
        try {
          const lat = sessionStorage.getItem('suraksha_user_lat');
          const lng = sessionStorage.getItem('suraksha_user_lng');
          if (lat && lng) {
            resolve({ latitude: parseFloat(lat), longitude: parseFloat(lng) });
            return;
          }
        } catch {}
        resolve(null);
      },
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false }
    );
  });
}

/**
 * Check a list of alerts against user's location and return proximity matches.
 */
export function evaluateProximityAlerts(alerts: Alert[], userCoords: UserCoordinates | null): ProximityMatch[] {
  const matches: ProximityMatch[] = [];

  for (const alert of alerts) {
    if (alert.status !== 'PUBLISHED') continue;
    if (alert.expiresAt && new Date(alert.expiresAt).getTime() < Date.now()) continue;

    const national = isNationalAlert(alert);

    if (national) {
      matches.push({
        alert,
        isNational: true,
        distanceKm: userCoords
          ? calculateDistanceKm(userCoords.latitude, userCoords.longitude, getAlertCentroid(alert).lat, getAlertCentroid(alert).lng)
          : null,
        isWithinProximity: true,
      });
      continue;
    }

    // Check hyperlocal proximity if coordinates are available
    if (userCoords) {
      const centroid = getAlertCentroid(alert);
      const dist = calculateDistanceKm(userCoords.latitude, userCoords.longitude, centroid.lat, centroid.lng);
      if (dist <= PROXIMITY_RADIUS_KM) {
        matches.push({
          alert,
          isNational: false,
          distanceKm: dist,
          isWithinProximity: true,
        });
      }
    }
  }

  return matches;
}

/**
 * Dispatch system notification and mobile device vibration.
 */
export function dispatchSystemNotification(alert: Alert, distanceKm: number | null): void {
  if (typeof window === 'undefined') return;

  // Mobile Device Vibration API
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([500, 250, 500, 250, 1000]);
    } catch {}
  }

  // Web Notification API
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const distText = distanceKm !== null ? `📍 ${distanceKm.toFixed(1)} km away — ` : '🚨 ';
      const notif = new Notification(`EMERGENCY ALERT: ${alert.headline}`, {
        body: `${distText}${alert.guidance || 'Immediate caution advised in your sector. Stay indoors or evacuate to higher ground.'}`,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: `suraksha-alert-${alert.id}`,
        requireInteraction: true,
      });

      notif.onclick = () => {
        window.focus();
        window.location.href = `/alerts/${alert.id}`;
      };
    } catch {}
  }
}

/**
 * Track alerted IDs in sessionStorage to prevent repeating sirens for the same alert.
 */
export function getSilencedAlertIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(SEEN_ALERTS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

export function silenceAlertId(alertId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const set = getSilencedAlertIds();
    set.add(alertId);
    sessionStorage.setItem(SEEN_ALERTS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}
