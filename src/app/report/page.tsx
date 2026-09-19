'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { compressImage } from '@/lib/imageCompression';
import { saveOfflineReport, flushOfflineQueue } from '@/lib/offlineQueue';
import { saveClientReport, isDemoReport } from '@/lib/clientSync';
import { translations, getSavedLanguage, type Language } from '@/lib/i18n';
import { HAZARD_CATEGORIES, SEVERITY_LABELS } from '@/types';
import type { HazardCategory, SeverityLevel, GeoPoint, Report } from '@/types';
import styles from './report.module.css';

type Step = 'category' | 'severity' | 'location' | 'details' | 'review';

export default function ReportPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>('en');
  const [step, setStep] = useState<Step>('category');
  const [category, setCategory] = useState<HazardCategory | null>(null);
  const [severity, setSeverity] = useState<SeverityLevel | null>(null);
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [locationName, setLocationName] = useState('');
  const [geocodeSuggestions, setGeocodeSuggestions] = useState<Array<{
    id: number;
    name: string;
    admin1?: string;
    latitude: number;
    longitude: number;
  }>>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [photoCompressed, setPhotoCompressed] = useState(false);
  const [recentReports, setRecentReports] = useState<Array<{
    id: string;
    category: string;
    severity: number;
    landmark: string;
    description: string;
    createdAt: string;
  }>>([]);
  const startTime = useRef(Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveToUserHistory = (id: string, reportPayload: any) => {
    if (typeof window === 'undefined') return;
    try {
      const existing = JSON.parse(localStorage.getItem('suraksha_my_reports') || '[]');
      const newEntry = {
        id,
        category: reportPayload.category,
        severity: reportPayload.severity,
        location: reportPayload.location,
        landmark: reportPayload.landmark || `${reportPayload.location?.latitude?.toFixed(4) || ''}°N, ${reportPayload.location?.longitude?.toFixed(4) || ''}°E`,
        description: reportPayload.description,
        createdAt: new Date().toISOString(),
      };
      const updated = [newEntry, ...existing.filter((r: any) => r.id !== id)].slice(0, 20);
      localStorage.setItem('suraksha_my_reports', JSON.stringify(updated));
      localStorage.setItem('suraksha_last_report_id', id);
      setRecentReports(updated);
    } catch {}
  };

  // Live Open-Meteo Indian Location Geocoder with debouncing
  useEffect(() => {
    if (!locationName || locationName.startsWith('GPS Position:')) {
      setGeocodeSuggestions([]);
      return;
    }
    const clean = locationName.trim();
    if (clean.length < 2) {
      setGeocodeSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsGeocoding(true);
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(clean)}&count=6&language=en&format=json&country_code=IN`
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.results)) {
            setGeocodeSuggestions(data.results);
          } else {
            setGeocodeSuggestions([]);
          }
        }
      } catch {}
      setIsGeocoding(false);
    }, 280);

    return () => clearTimeout(timer);
  }, [locationName]);

  useEffect(() => {
    setLang(getSavedLanguage());
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem('suraksha_my_reports') || '[]').filter((r: any) => !isDemoReport(r));
        setRecentReports(saved);
      } catch {}
    }
    flushOfflineQueue((localId, serverId) => {
      if (typeof window !== 'undefined') {
        try {
          const existing = JSON.parse(localStorage.getItem('suraksha_my_reports') || '[]').filter((r: any) => !isDemoReport(r));
          const updated = existing.map((r: any) => r.id === localId ? { ...r, id: serverId } : r);
          localStorage.setItem('suraksha_my_reports', JSON.stringify(updated));
          if (localStorage.getItem('suraksha_last_report_id') === localId) {
            localStorage.setItem('suraksha_last_report_id', serverId);
          }
          setRecentReports(updated);
        } catch {}
      }
    });
    const onLangChange = (e: Event) => {
      const customEvent = e as CustomEvent<Language>;
      if (customEvent.detail) setLang(customEvent.detail);
    };
    window.addEventListener('languagechange', onLangChange);
    return () => window.removeEventListener('languagechange', onLangChange);
  }, []);

  const steps: Step[] = ['category', 'severity', 'location', 'details', 'review'];
  const currentIndex = steps.indexOf(step);
  const progress = ((currentIndex + 1) / steps.length) * 100;

  // —— GPS ——
  const requestGPS = () => {
    setGpsLoading(true);
    setGpsError(null);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          setLocationName(`GPS Position: ${pos.coords.latitude.toFixed(4)}°N, ${pos.coords.longitude.toFixed(4)}°E`);
          setGeocodeSuggestions([]);
          setGpsLoading(false);
        },
        () => {
          setGpsError('GPS permission not granted or signal timed out. Please select your city or search your neighborhood below.');
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGpsError('Geolocation is not supported by this browser. Please select or search your city below.');
      setGpsLoading(false);
    }
  };

  // —— Photo with Client-Side Compression (<150KB) ——
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 1280, 0.72);
        setPhoto(compressed.file);
        setPhotoPreview(compressed.dataUrl);
        setPhotoCompressed(true);
      } catch {
        setPhoto(file);
        const reader = new FileReader();
        reader.onloadend = () => setPhotoPreview(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  // —— Submit with Offline Queue Fallback & Complete Reliability ——
  const handleSubmit = async () => {
    if (!category || !severity) {
      setError('Please complete category and severity selections.');
      return;
    }
    if (!description || description.trim().length < 5) {
      setError('Please provide a brief description of observed hazard (minimum 5 characters).');
      return;
    }
    if (!location) {
      setError('Please specify your hazard location using GPS or by selecting a city/searching your neighborhood.');
      setStep('location');
      return;
    }

    setSubmitting(true);
    setError(null);

    const finalLocation = location;
    const finalLandmark = locationName.trim() || `Sector near ${location.latitude.toFixed(4)}°N, ${location.longitude.toFixed(4)}°E`;

    const payload = {
      category,
      severity,
      description: description.trim(),
      location: finalLocation,
      landmark: finalLandmark,
      mediaUrl: photoPreview || undefined,
      waterDepthFeet: severity >= 4 ? 4.5 : severity === 3 ? 2.5 : 1.0,
      consent: true,
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const offlineId = saveOfflineReport(payload);
      setReportId(offlineId);
      setSubmitted(true);
      setSubmitting(false);
      saveToUserHistory(offlineId, payload);
      const offlineReport: Report = {
        id: offlineId,
        reporterId: 'citizen_local',
        reporterPseudonym: 'Citizen Reporter (Offline)',
        category,
        severity,
        description: description.trim(),
        location: finalLocation,
        h3Index: '882a7bcfa911fffff',
        landmark: finalLandmark,
        waterDepthFeet: severity >= 4 ? 4.5 : severity === 3 ? 2.5 : 1.0,
        consent: true,
        status: 'RECEIVED',
        verificationStatus: 'PENDING_VERIFICATION',
        currentActionCategory: 'Pending Verification',
        actionHistory: [
          {
            id: 'act_' + Date.now(),
            action: 'Pending Verification',
            actorName: 'Telemetry Gateway',
            notes: 'Report queued for offline synchronization.',
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveClientReport(offlineReport);
      return;
    }

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success && data.data?.id) {
        setReportId(data.data.id);
        setSubmitted(true);
        saveToUserHistory(data.data.id, payload);

        const fullReport: Report = {
          id: data.data.id,
          reporterId: 'citizen_local',
          reporterPseudonym: data.data.pseudonym || 'Citizen Reporter',
          category,
          severity,
          description: description.trim(),
          location: finalLocation,
          h3Index: '882a7bcfa911fffff',
          landmark: finalLandmark,
          waterDepthFeet: severity >= 4 ? 4.5 : severity === 3 ? 2.5 : 1.0,
          consent: true,
          status: 'RECEIVED',
          verificationStatus: 'PENDING_VERIFICATION',
          currentActionCategory: 'Pending Verification',
          actionHistory: [
            {
              id: 'act_' + Date.now(),
              action: 'Pending Verification',
              actorName: 'Telemetry Gateway',
              notes: 'Report submitted by citizen and queued for meteorologist verification vs Doppler radar.',
              timestamp: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        saveClientReport(fullReport);
      } else {
        // Resilient fallback: save locally and mark submitted so citizen's hazard is visible on map
        const fallbackId = saveOfflineReport(payload);
        setReportId(fallbackId);
        setSubmitted(true);
        saveToUserHistory(fallbackId, payload);
        const fallbackReport: Report = {
          id: fallbackId,
          reporterId: 'citizen_local',
          reporterPseudonym: 'Citizen Reporter',
          category,
          severity,
          description: description.trim(),
          location: finalLocation,
          h3Index: '882a7bcfa911fffff',
          landmark: finalLandmark,
          waterDepthFeet: severity >= 4 ? 4.5 : severity === 3 ? 2.5 : 1.0,
          consent: true,
          status: 'RECEIVED',
          verificationStatus: 'PENDING_VERIFICATION',
          currentActionCategory: 'Pending Verification',
          actionHistory: [
            {
              id: 'act_' + Date.now(),
              action: 'Pending Verification',
              actorName: 'Telemetry Gateway',
              notes: 'Report queued in verification network.',
              timestamp: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        saveClientReport(fallbackReport);
      }
    } catch (err) {
      // Connection or server error fallback
      const offlineId = saveOfflineReport(payload);
      setReportId(offlineId);
      setSubmitted(true);
      saveToUserHistory(offlineId, payload);
      const offlineReport: Report = {
        id: offlineId,
        reporterId: 'citizen_local',
        reporterPseudonym: 'Citizen Reporter',
        category,
        severity,
        description: description.trim(),
        location: finalLocation,
        h3Index: '882a7bcfa911fffff',
        landmark: finalLandmark,
        waterDepthFeet: severity >= 4 ? 4.5 : severity === 3 ? 2.5 : 1.0,
        consent: true,
        status: 'RECEIVED',
        verificationStatus: 'PENDING_VERIFICATION',
        currentActionCategory: 'Pending Verification',
        actionHistory: [
          {
            id: 'act_' + Date.now(),
            action: 'Pending Verification',
            actorName: 'Telemetry Gateway',
            notes: 'Report queued for synchronization.',
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveClientReport(offlineReport);
    } finally {
      setSubmitting(false);
    }
  };

  const timeTaken = Math.round((Date.now() - startTime.current) / 1000);

  // —— Submitted View ——
  if (submitted) {
    return (
      <div className={styles.page}>
        <Navbar />
        <div className={styles.container}>
          <div className={styles.receiptCard}>
            <div className={styles.receiptIcon}>🛡️</div>
            <h1 className={styles.receiptTitle}>Hazard Log Recorded</h1>
            <p className={styles.receiptSubtitle}>
              Thank you for contributing ground truth intelligence. Your report has been submitted to the verification network.
            </p>

            <div className={styles.receiptDetails}>
              <div className={styles.receiptRow}>
                <span>Report ID</span>
                <span className={styles.receiptValue} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <code style={{ fontSize: '0.88rem', background: '#DCEEF2', color: '#4C8DA2', padding: '4px 10px', borderRadius: 9999, fontFamily: 'var(--font-family-mono, monospace)', fontWeight: 700, border: '1px solid #C8E3EA' }}>
                    {reportId}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      if (reportId) {
                        navigator.clipboard.writeText(reportId);
                        alert('Report ID copied to clipboard: ' + reportId);
                      }
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                    title="Copy Report ID"
                  >
                    Copy ID
                  </button>
                </span>
              </div>
              <div className={styles.receiptRow}>
                <span>Status</span>
                <span className="badge badge-info">{reportId?.startsWith('OFFLINE') ? 'Queued (Offline Sync)' : 'Received & Queued'}</span>
              </div>
              <div className={styles.receiptRow}>
                <span>Hazard</span>
                <span>{category && HAZARD_CATEGORIES[category].icon} {category && HAZARD_CATEGORIES[category].label}</span>
              </div>
              <div className={styles.receiptRow}>
                <span>Severity</span>
                <span>{severity && SEVERITY_LABELS[severity].label}</span>
              </div>
              {photoCompressed && (
                <div className={styles.receiptRow}>
                  <span>Telemetry Photo</span>
                  <span className="badge badge-success">Optimized (&lt;150KB)</span>
                </div>
              )}
              <div className={styles.receiptRow}>
                <span>Submission Latency</span>
                <span style={{ fontFamily: 'monospace' }}>{timeTaken}s</span>
              </div>
            </div>

            <div className={styles.receiptNotice}>
              <p><strong>Verification & Routing Protocol</strong></p>
              <p>Your observation is queued for correlation against Doppler radar reflectivity and local hydrological sensors. Verified hazards appear on the public Live Risk Map.</p>
              <p className={styles.receiptWarning}>
                ⚠️ In life-threatening emergencies requiring immediate rescue or medical triage, call <strong>112</strong> immediately.
              </p>
            </div>

            <div className={styles.receiptActions} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href={`/track?id=${reportId}`} className="btn btn-primary btn-lg" style={{ flex: 1, textAlign: 'center' }}>
                Track Live Status →
              </Link>
              <Link
                href={`/map?lat=${(location || { latitude: 26.8467, longitude: 80.9462 }).latitude}&lng=${(location || { latitude: 26.8467, longitude: 80.9462 }).longitude}${reportId ? `&highlight=${reportId}` : ''}`}
                className="btn btn-secondary btn-lg"
                style={{ textAlign: 'center' }}
              >
                Inspect on Live Map
              </Link>
              <Link href="/" className="btn btn-secondary btn-lg">
                Home
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Navbar />
      {/* Workflow Navigation */}
      <div className={styles.workflowHeader}>
        <div className={styles.breadcrumb}>
          <Link href="/">Home</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>Report Hazard</span>
        </div>
        <div className={styles.stepTrack}>
          {steps.map((s, idx) => {
            const stepLabels: Record<Step, string> = {
              category: '1. Hazard',
              severity: '2. Severity',
              location: '3. Location',
              details: '4. Details',
              review: '5. Review',
            };
            const isDone = idx < currentIndex;
            const isActive = idx === currentIndex;
            return (
              <span
                key={s}
                className={`${styles.stepPill} ${isActive ? styles.stepPillActive : isDone ? styles.stepPillDone : ''}`}
              >
                {isDone ? '✓ ' : ''}{stepLabels[s]}
              </span>
            );
          })}
        </div>
      </div>

      {/* Progress Bar */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.container}>
        {/* Emergency Life-Safety Notice */}
        <aside className={styles.emergencyDisclaimer} role="alert">
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>🚨</span>
          <div>
            <strong>Immediate Threat to Life?</strong> If you or someone nearby is trapped, in danger of drowning, or requires emergency evacuation, dial <strong>112</strong> immediately. Web submissions are triaged by municipal response teams.
          </div>
        </aside>

        {/* Active Reported Hazard Banner (Instant Status & Recovery) */}
        {recentReports.length > 0 && (
          <div className={styles.activeReportBanner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.6rem' }}>🛡️</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <strong style={{ color: '#1F3440', fontSize: '0.95rem', fontFamily: "var(--font-family-heading, 'Manrope', sans-serif)" }}>
                    Active Hazard Reported by You
                  </strong>
                  <span className={styles.activeReportBadge}>
                    ID: {recentReports[0].id}
                  </span>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#60717B' }}>
                  {recentReports[0].landmark} · {HAZARD_CATEGORIES[recentReports[0].category as HazardCategory]?.icon || '⚠️'} {recentReports[0].category} · Severity {recentReports[0].severity}/5
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Link
                href={`/track?id=${encodeURIComponent(recentReports[0].id)}`}
                className="btn btn-primary btn-sm"
                style={{ textDecoration: 'none' }}
              >
                Track Live Status →
              </Link>
              <Link
                href="/map"
                className="btn btn-secondary btn-sm"
                style={{ textDecoration: 'none' }}
              >
                Inspect Map
              </Link>
            </div>
          </div>
        )}

        {/* Step 1: Category */}
        {step === 'category' && (
          <div className={styles.stepContent}>
            <div style={{ marginBottom: '16px' }}>
              <h2 className={styles.stepTitle} style={{ margin: 0 }}>What hazard do you see?</h2>
              <p className={styles.stepSubtitle} style={{ margin: '4px 0 0' }}>Select the type of weather hazard you are observing</p>
            </div>
            <div className={styles.categoryGrid}>
              {(Object.entries(HAZARD_CATEGORIES) as [HazardCategory, typeof HAZARD_CATEGORIES[HazardCategory]][]).map(([key, info]) => (
                <button
                  key={key}
                  className={`${styles.categoryTile} ${category === key ? styles.categorySelected : ''}`}
                  onClick={() => { setCategory(key); setStep('severity'); }}
                  id={`category-${key.toLowerCase()}`}
                >
                  <span className={styles.categoryIcon}>{info.icon}</span>
                  <span className={styles.categoryLabel}>{info.label}</span>
                  <span className={styles.categoryLabelHi}>{info.labelHi}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Severity */}
        {step === 'severity' && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>How severe is it?</h2>
            <p className={styles.stepSubtitle}>
              {category && `${HAZARD_CATEGORIES[category].icon} ${HAZARD_CATEGORIES[category].label}`} — Select observed severity
            </p>
            <div className={styles.severityList}>
              {([1, 2, 3, 4, 5] as SeverityLevel[]).map((level) => {
                const info = SEVERITY_LABELS[level];
                return (
                  <button
                    key={level}
                    className={`${styles.severityCard} ${severity === level ? styles.severitySelected : ''}`}
                    onClick={() => { setSeverity(level); setStep('location'); }}
                    id={`severity-${level}`}
                  >
                    <div className={styles.severityIndicator} style={{ background: info.color }}>
                      {level}
                    </div>
                    <div className={styles.severityInfo}>
                      <span className={styles.severityLabel}>{info.label} / {info.labelHi}</span>
                      <span className={styles.severityDesc}>{info.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <button className="btn btn-ghost" onClick={() => setStep('category')}>← Back</button>
          </div>
        )}

        {/* Step 3: Location */}
        {step === 'location' && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Where is it happening?</h2>
            <p className={styles.stepSubtitle}>Share your location so authorities know the exact area</p>

            <div className={styles.locationOptions}>
              <button
                className="btn btn-primary btn-lg"
                onClick={requestGPS}
                disabled={gpsLoading}
                id="request-gps"
                style={{ width: '100%' }}
              >
                {gpsLoading ? (
                  <><div className="spinner" style={{ width: 20, height: 20 }} /> Acquiring GPS coordinates…</>
                ) : (
                  <>📍 Detect My Current Location (GPS)</>
                )}
              </button>

              {gpsError && <p className={styles.gpsError}>{gpsError}</p>}

              {location && (
                <div className={styles.locationResult}>
                  <span className={styles.locationPin}>📍</span>
                  <div>
                    <p className={styles.locationName}>{locationName || 'Location Established'}</p>
                    <p className={styles.locationAccuracy}>
                      GPS Coordinates: {location.latitude.toFixed(4)}°N, {location.longitude.toFixed(4)}°E (±{location.accuracy ? Math.round(location.accuracy) : '20'}m)
                    </p>
                  </div>
                </div>
              )}

              <div className={styles.locationDivider}>
                <span>or select Indian metropolitan hub</span>
              </div>

              <div className={styles.hubList}>
                {[
                  { name: 'Lucknow', lat: 26.8467, lng: 80.9462 },
                  { name: 'Delhi NCR', lat: 28.6139, lng: 77.2090 },
                  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
                  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
                  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
                  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
                  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
                  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
                  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
                  { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
                  { name: 'Guwahati', lat: 26.1445, lng: 91.7362 },
                  { name: 'Shimla', lat: 31.1048, lng: 77.1734 },
                ].map((c) => {
                  const isMatch = location && Math.abs(location.latitude - c.lat) < 0.05 && Math.abs(location.longitude - c.lng) < 0.05;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      className={`${styles.hubBtn} ${isMatch ? styles.hubBtnActive : ''}`}
                      onClick={() => {
                        setLocation({ latitude: c.lat, longitude: c.lng, accuracy: 25 });
                        setLocationName(`${c.name} (Station Region)`);
                        setGeocodeSuggestions([]);
                      }}
                    >
                      📍 {c.name}
                    </button>
                  );
                })}
              </div>

              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Type city, street, or sector in India (e.g. Hazratganj Lucknow, Dadar Mumbai)..."
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  id="location-search"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
                {isGeocoding && (
                  <span style={{ position: 'absolute', right: 12, top: 12, fontSize: 11, color: '#38BDF8' }}>
                    Searching coordinates…
                  </span>
                )}

                {/* Geocoding suggestions dropdown */}
                {geocodeSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: '#0a1d30',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    borderRadius: '8px',
                    marginTop: '4px',
                    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.65)',
                    overflow: 'hidden',
                  }}>
                    {geocodeSuggestions.map((item) => (
                      <button
                        key={`${item.id}-${item.latitude}`}
                        type="button"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 14px',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
                          color: '#F8FAFC',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '12.5px',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => {
                          setLocation({
                            latitude: item.latitude,
                            longitude: item.longitude,
                            accuracy: 25,
                          });
                          setLocationName(`${item.name}${item.admin1 ? `, ${item.admin1}` : ''}, India`);
                          setGeocodeSuggestions([]);
                        }}
                      >
                        <div>
                          <strong>📍 {item.name}</strong>
                          <span style={{ color: '#94A3B8', marginLeft: 6 }}>
                            {item.admin1 ? `${item.admin1}, India` : 'India'}
                          </span>
                        </div>
                        <span style={{ fontFamily: 'monospace', fontSize: '10.5px', color: '#38BDF8' }}>
                          {item.latitude.toFixed(3)}°N, {item.longitude.toFixed(3)}°E
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.stepActions}>
              <button className="btn btn-ghost" onClick={() => setStep('severity')}>← Back</button>
              <button
                className="btn btn-primary"
                onClick={() => setStep('details')}
                disabled={!location}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Details */}
        {step === 'details' && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Tell us more</h2>
            <p className={styles.stepSubtitle}>Add a description and optional photo</p>

            <div className={styles.detailsForm}>
              <div className="input-group">
                <label className="input-label" htmlFor="description">Description *</label>
                <textarea
                  id="description"
                  className="input textarea"
                  placeholder="What do you see? How deep is the water? Are roads accessible? Is anyone in danger?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={4}
                />
                <span className={styles.charCount}>{description.length}/500</span>
              </div>

              <div className="input-group">
                <label className="input-label">Photo (optional)</label>
                <div
                  className={styles.photoUpload}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Report photo" className={styles.photoPreview} />
                  ) : (
                    <div className={styles.photoPlaceholder}>
                      <span>📸</span>
                      <span>Tap to add a photo</span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhoto}
                  style={{ display: 'none' }}
                  id="photo-input"
                />
              </div>
            </div>

            <div className={styles.stepActions}>
              <button className="btn btn-ghost" onClick={() => setStep('location')}>← Back</button>
              <button
                className="btn btn-primary"
                onClick={() => setStep('review')}
                disabled={!description || description.length < 5}
              >
                Review Report →
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Review & Submit */}
        {step === 'review' && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Review your report</h2>
            <p className={styles.stepSubtitle}>Please confirm the details before submitting</p>

            <div className={styles.reviewCard}>
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Hazard</span>
                <span>{category && HAZARD_CATEGORIES[category].icon} {category && HAZARD_CATEGORIES[category].label}</span>
              </div>
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Severity</span>
                <span style={{ color: severity ? SEVERITY_LABELS[severity].color : undefined }}>
                  {severity && `${severity} — ${SEVERITY_LABELS[severity].label}`}
                </span>
              </div>
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Location</span>
                <span>📍 {locationName}</span>
              </div>
              <div className={styles.reviewRow}>
                <span className={styles.reviewLabel}>Description</span>
                <span>{description}</span>
              </div>
              {photoPreview && (
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>Photo</span>
                  <img src={photoPreview} alt="Report" className={styles.reviewPhoto} />
                </div>
              )}
            </div>

            <div className={styles.consentBox}>
              <label className={styles.consentLabel}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  id="consent-checkbox"
                />
                <span>
                  I confirm this report is based on my genuine observation. I consent to this information being reviewed and used for public safety. My exact location will not be shared publicly.
                </span>
              </label>
            </div>

            {error && (
              <div className={styles.errorBanner}>❌ {error}</div>
            )}

            <div className={styles.stepActions}>
              <button className="btn btn-ghost" onClick={() => setStep('details')}>← Back</button>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleSubmit}
                disabled={!consent || submitting}
                id="submit-report"
              >
                {submitting ? (
                  <><div className="spinner" style={{ width: 20, height: 20 }} /> Submitting…</>
                ) : (
                  '🚨 Submit Report'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
