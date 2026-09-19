'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { Alert } from '@/types';
import {
  getCurrentUserLocation,
  evaluateProximityAlerts,
  dispatchSystemNotification,
  getSilencedAlertIds,
  silenceAlertId,
  type ProximityMatch,
  type UserCoordinates,
} from '@/lib/proximityAlertEngine';
import {
  playEmergencySiren,
  stopEmergencySiren,
  unlockAudioContext,
} from '@/lib/emergencyAudio';

export function EmergencyAlertMonitor() {
  const [activeMatch, setActiveMatch] = useState<ProximityMatch | null>(null);
  const [isSirenActive, setIsSirenActive] = useState(false);
  const [userLocation, setUserLocation] = useState<UserCoordinates | null>(null);
  const userInteractedRef = useRef(false);

  // 1. Silently unlock Web Audio API context on first user interaction anywhere on the screen
  useEffect(() => {
    const handleInteraction = () => {
      if (!userInteractedRef.current) {
        userInteractedRef.current = true;
        unlockAudioContext();
        // Also request notification permission if not yet decided
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
      }
    };

    window.addEventListener('click', handleInteraction, { once: true, passive: true });
    window.addEventListener('touchstart', handleInteraction, { once: true, passive: true });
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  // 2. Fetch user location on mount and periodic watch
  useEffect(() => {
    getCurrentUserLocation().then((coords) => {
      if (coords) setUserLocation(coords);
    });

    if (typeof window !== 'undefined' && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        () => {},
        { timeout: 15000, maximumAge: 60000, enableHighAccuracy: false }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const matchesRef = useRef<ProximityMatch[]>([]);

  // 3. Periodic Poll for Alerts and Proximity Evaluation
  const checkAlerts = useCallback(async () => {
    try {
      const res = await fetch(`/api/alerts?status=active&_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const alerts: Alert[] = data.data || [];

      const matches = evaluateProximityAlerts(alerts, userLocation);
      matchesRef.current = matches;
      const silenced = getSilencedAlertIds();

      // Find first active match that hasn't been silenced yet
      const unacknowledged = matches.find((m) => !silenced.has(m.alert.id));

      if (unacknowledged) {
        setActiveMatch(unacknowledged);

        // Sound emergency alarm
        if (!isSirenActive) {
          playEmergencySiren();
          setIsSirenActive(true);
          dispatchSystemNotification(unacknowledged.alert, unacknowledged.distanceKm);
        }
      } else if (matches.length === 0 && activeMatch) {
        // Hazard passed
        stopEmergencySiren();
        setIsSirenActive(false);
        setActiveMatch(null);
      }
    } catch {
      // Graceful background failure
    }
  }, [userLocation, isSirenActive, activeMatch]);

  useEffect(() => {
    checkAlerts();
    const interval = setInterval(checkAlerts, 5000);
    return () => clearInterval(interval);
  }, [checkAlerts]);

  // Silence Siren & Acknowledge
  const handleSilenceSiren = () => {
    stopEmergencySiren();
    setIsSirenActive(false);
    if (activeMatch) {
      silenceAlertId(activeMatch.alert.id);
    }
    // Also silence all current matches so citizen isn't hit repeatedly if multiple alerts are active
    matchesRef.current.forEach((m) => silenceAlertId(m.alert.id));
    setActiveMatch(null);
  };

  if (!activeMatch) return null;

  const { alert, isNational, distanceKm } = activeMatch;

  return (
    <aside
      aria-label="Critical Emergency Alert"
      role="alert"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: 'linear-gradient(135deg, #B91C1C 0%, #7F1D1D 100%)',
        color: '#FFFFFF',
        boxShadow: '0 8px 32px rgba(185, 28, 28, 0.45)',
        borderBottom: '3px solid #EF4444',
        padding: 'max(16px, env(safe-area-inset-top, 16px)) 16px 14px',
        animation: 'emergencySlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
          <span
            style={{
              fontSize: '1.75rem',
              lineHeight: 1,
              animation: 'emergencyPulseIcon 1s infinite alternate',
            }}
          >
            🚨
          </span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  background: '#FEF2F2',
                  color: '#991B1B',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  textTransform: 'uppercase',
                }}
              >
                {isNational ? 'National Alert' : 'Immediate Vicinity Hazard'}
              </span>
              {distanceKm !== null && !isNational && (
                <span style={{ fontSize: '12px', color: '#FEE2E2', fontWeight: 600 }}>
                  📍 Approx {distanceKm.toFixed(1)} km from your location
                </span>
              )}
            </div>
            <h4 style={{ margin: '3px 0 2px', fontSize: '0.96rem', fontWeight: 800, color: '#FFFFFF' }}>
              {alert.headline}
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#FECACA', lineHeight: 1.3 }}>
              {alert.guidance || 'Seek immediate shelter. Severe weather hazard confirmed in sector.'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleSilenceSiren}
            style={{
              background: '#FFFFFF',
              color: '#991B1B',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            <span>🔇</span>
            <span>Silence Siren</span>
          </button>

          <Link
            href={`/alerts/${alert.id}`}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              color: '#FFFFFF',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            🧭 View Full Guidance →
          </Link>
        </div>
      </div>
      <style>{`
        @keyframes emergencySlideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
        @keyframes emergencyPulseIcon {
          from { transform: scale(0.95); }
          to { transform: scale(1.15); }
        }
      `}</style>
    </aside>
  );
}
