'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { compressImage } from '@/lib/imageCompression';
import { saveOfflineReport, flushOfflineQueue } from '@/lib/offlineQueue';
import { saveClientReport } from '@/lib/clientSync';
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
  const [location, setLocation] = useState<GeoPoint | null>({ latitude: 28.6139, longitude: 77.2090, accuracy: 25 });
  const [locationName, setLocationName] = useState('Delhi NCR (Connaught Place / Minto Bridge)');
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

  useEffect(() => {
    setLang(getSavedLanguage());
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem('suraksha_my_reports') || '[]');
        setRecentReports(saved);
      } catch {}
    }
    flushOfflineQueue((localId, serverId) => {
      if (typeof window !== 'undefined') {
        try {
          const existing = JSON.parse(localStorage.getItem('suraksha_my_reports') || '[]');
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
          setLocationName(`${pos.coords.latitude.toFixed(4)}°N, ${pos.coords.longitude.toFixed(4)}°E`);
          setGpsLoading(false);
        },
        (err) => {
          setGpsError('Could not get GPS. Using default coordinates (Delhi NCR).');
          setGpsLoading(false);
          setLocation({ latitude: 28.6139, longitude: 77.2090, accuracy: 50 });
          setLocationName('Delhi NCR (Connaught Place / Minto Bridge)');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGpsError('GPS not available on this device. Using default coordinates.');
      setGpsLoading(false);
      setLocation({ latitude: 28.6139, longitude: 77.2090, accuracy: 50 });
      setLocationName('Delhi NCR (Connaught Place / Minto Bridge)');
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

    setSubmitting(true);
    setError(null);

    const finalLocation = location || { latitude: 28.6139, longitude: 77.2090, accuracy: 25 };
    const finalLandmark = locationName || 'Delhi NCR (Station Region)';

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
        setError(data.error || 'Server error submitting report. Please try again.');
      }
    } catch (err) {
      // Real offline / connection error fallback
      const offlineId = saveOfflineReport(payload);
      setReportId(offlineId);
      setSubmitted(true);
      saveToUserHistory(offlineId, payload);
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
            <div className={styles.receiptIcon}>✅</div>
            <h1 className={styles.receiptTitle}>Report Received</h1>
            <p className={styles.receiptSubtitle}>
              Thank you for helping keep your community safe.
            </p>

            <div className={styles.receiptDetails}>
              <div className={styles.receiptRow}>
                <span>Report ID</span>
                <span className={styles.receiptValue} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <code style={{ fontSize: '0.92rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', padding: '3px 8px', borderRadius: 4, fontFamily: 'monospace', fontWeight: 700 }}>
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
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#E2E8F0', padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontSize: '0.78rem' }}
                    title="Copy Report ID"
                  >
                    📋 Copy ID
                  </button>
                </span>
              </div>
              <div className={styles.receiptRow}>
                <span>Status</span>
                <span className="badge badge-info">{reportId?.startsWith('OFFLINE') ? 'Queued (Offline Sync)' : 'Received'}</span>
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
                  <span>Photo Status</span>
                  <span className="badge badge-success">Compressed (&lt;150KB)</span>
                </div>
              )}
              <div className={styles.receiptRow}>
                <span>Time to Report</span>
                <span>{timeTaken}s</span>
              </div>
            </div>

            <div className={styles.receiptNotice}>
              <p><strong>What happens next?</strong></p>
              <p>Your report will be reviewed by a verified meteorologist. If corroborated by other reports and weather evidence, it may contribute to a public alert.</p>
              <p className={styles.receiptWarning}>
                ⚠️ This report is <strong>not</strong> an official alert. In life-threatening emergencies, call <strong>112</strong>.
              </p>
            </div>

            <div className={styles.receiptActions} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href={`/track?id=${reportId}`} className="btn btn-primary btn-lg" style={{ flex: 1, textAlign: 'center' }}>
                🔍 Track Status in Real Time →
              </Link>
              <Link
                href={`/map?lat=${(location || { latitude: 28.6139, longitude: 77.2090 }).latitude}&lng=${(location || { latitude: 28.6139, longitude: 77.2090 }).longitude}${reportId ? `&highlight=${reportId}` : ''}`}
                className="btn btn-secondary btn-lg"
                style={{ textAlign: 'center' }}
              >
                🗺️ View on Live Map
              </Link>
              <Link href="/" className="btn btn-secondary btn-lg">
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Navbar />
      {/* Header */}
      <header className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/" className={styles.backBtn}>← Home</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🛡️</span>
            <strong style={{ fontSize: 14, color: '#F7F6F2', letterSpacing: '0.06em' }}>SURAKSHA SETU</strong>
            <span style={{ fontSize: 11, color: '#8A99A8', borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: 8 }}>
              सुरक्षा सेतु · Ground Truth Reporting
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/map" style={{ color: '#8A99A8', fontSize: 12.5, textDecoration: 'none' }}>
            Live Map →
          </Link>
          <span className={styles.stepIndicator}>Step {currentIndex + 1} of {steps.length}</span>
        </div>
      </header>

      {/* Progress Bar */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.container}>
        {/* Active Reported Hazard Banner (Instant Status & Recovery) */}
        {recentReports.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(14, 116, 144, 0.25) 0%, rgba(15, 23, 42, 0.7) 100%)',
            border: '1px solid #38BDF8',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.8rem' }}>🛡️</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <strong style={{ color: '#F7F6F2', fontSize: '0.98rem' }}>
                    Active Hazard Reported by You
                  </strong>
                  <span style={{
                    background: 'rgba(56, 189, 248, 0.2)',
                    color: '#38BDF8',
                    border: '1px solid #38BDF8',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    fontWeight: 700
                  }}>
                    ID: {recentReports[0].id}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#CBD5E1' }}>
                  {recentReports[0].landmark} · {HAZARD_CATEGORIES[recentReports[0].category as HazardCategory]?.icon || '⚠️'} {recentReports[0].category} · Severity {recentReports[0].severity}/5
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Link
                href={`/track?id=${encodeURIComponent(recentReports[0].id)}`}
                className="btn btn-primary"
                style={{ fontSize: '0.85rem', padding: '8px 16px', textDecoration: 'none', fontWeight: 700 }}
              >
                🔍 Track Real-Time Status →
              </Link>
              <Link
                href="/staff/admin"
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem', padding: '8px 14px', textDecoration: 'none' }}
              >
                ⚙️ Admin Console
              </Link>
            </div>
          </div>
        )}

        {/* Step 1: Category */}
        {step === 'category' && (
          <div className={styles.stepContent}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div>
                <h2 className={styles.stepTitle} style={{ margin: 0 }}>What hazard do you see?</h2>
                <p className={styles.stepSubtitle} style={{ margin: '4px 0 0' }}>Select the type of weather hazard you are observing</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCategory('WATERLOGGING');
                  setSeverity(4);
                  setLocation({ latitude: 28.6360, longitude: 77.2250, accuracy: 15 });
                  setLocationName('Minto Bridge Underpass, Connaught Place, New Delhi');
                  setDescription('Severe waterlogging 4.5ft under Minto Bridge underpass. Road submerged, traffic completely blocked.');
                  setStep('review');
                }}
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid #38BDF8',
                  color: '#38BDF8',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ⚡ 1-Click Fast Hazard Report (Minto Bridge Waterlogging)
              </button>
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
                  <><div className="spinner" style={{ width: 20, height: 20 }} /> Getting location…</>
                ) : (
                  <>📍 Use My Current Location (GPS)</>
                )}
              </button>

              {gpsError && <p className={styles.gpsError}>{gpsError}</p>}

              {location && (
                <div className={styles.locationResult}>
                  <span className={styles.locationPin}>📍</span>
                  <div>
                    <p className={styles.locationName}>{locationName}</p>
                    <p className={styles.locationAccuracy}>
                      Accuracy: ±{location.accuracy ? Math.round(location.accuracy) : '?'}m
                      {location.accuracy && location.accuracy > 100 && (
                        <span className={styles.accuracyWarn}> (low accuracy)</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              <div className={styles.locationDivider}>
                <span>or select Indian hub / enter manually</span>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {[
                  { name: 'Delhi NCR', lat: 28.6139, lng: 77.2090 },
                  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
                  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
                  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
                  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
                  { name: 'Guwahati', lat: 26.1445, lng: 91.7362 },
                  { name: 'Shimla', lat: 31.1048, lng: 77.1734 },
                  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
                ].map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '5px 9px', background: 'rgba(255,255,255,0.06)' }}
                    onClick={() => {
                      setLocation({ latitude: c.lat, longitude: c.lng, accuracy: 25 });
                      setLocationName(`${c.name} (Station Region)`);
                    }}
                  >
                    📍 {c.name}
                  </button>
                ))}
              </div>

              <input
                type="text"
                className="input"
                placeholder="Search city, sector, landmark, or PIN code in India…"
                value={locationName}
                onChange={(e) => {
                  setLocationName(e.target.value);
                  if (!location) {
                    setLocation({ latitude: 20.5937, longitude: 78.9629, accuracy: 500 });
                  }
                }}
                id="location-search"
              />
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
    </div>
  );
}
