'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { compressImage } from '@/lib/imageCompression';
import { saveOfflineReport, flushOfflineQueue } from '@/lib/offlineQueue';
import { translations, getSavedLanguage, type Language } from '@/lib/i18n';
import { HAZARD_CATEGORIES, SEVERITY_LABELS } from '@/types';
import type { HazardCategory, SeverityLevel, GeoPoint } from '@/types';
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
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [photoCompressed, setPhotoCompressed] = useState(false);
  const startTime = useRef(Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLang(getSavedLanguage());
    flushOfflineQueue();
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
          setGpsError('Could not get GPS. You can enter location manually below.');
          setGpsLoading(false);
          // Fallback: Mumbai coordinates for demo
          setLocation({ latitude: 19.0760, longitude: 72.8777, accuracy: 1000 });
          setLocationName('Mumbai (approximate)');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGpsError('GPS not available on this device.');
      setGpsLoading(false);
      setLocation({ latitude: 19.0760, longitude: 72.8777, accuracy: 1000 });
      setLocationName('Mumbai (approximate)');
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

  // —— Submit with Offline Queue Fallback ——
  const handleSubmit = async () => {
    if (!category || !severity || !location || !description || !consent) return;

    setSubmitting(true);
    setError(null);

    const payload = {
      category,
      severity,
      description,
      location,
      consent: true,
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const offlineId = saveOfflineReport(payload);
      setReportId(offlineId);
      setSubmitted(true);
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setReportId(data.data.id);
        setSubmitted(true);
      } else {
        const offlineId = saveOfflineReport(payload);
        setReportId(offlineId);
        setSubmitted(true);
      }
    } catch {
      const offlineId = saveOfflineReport(payload);
      setReportId(offlineId);
      setSubmitted(true);
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
                <span className={styles.receiptValue}>{reportId?.slice(0, 16)}</span>
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
        {/* Step 1: Category */}
        {step === 'category' && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>What hazard do you see?</h2>
            <p className={styles.stepSubtitle}>Select the type of weather hazard you are observing</p>
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
