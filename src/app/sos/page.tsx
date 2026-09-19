'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import type { SosRequest } from '@/types';
import styles from './sos.module.css';

export default function SosHubPage() {
  const [activeTab, setActiveTab] = useState<'beacon' | 'feed' | 'helpline'>('beacon');
  const [beacons, setBeacons] = useState<SosRequest[]>([]);
  const [loadingFeed, setLoadingFeed] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Beacon Form State
  const [reporterName, setReporterName] = useState('');
  const [phone, setPhone] = useState('');
  const [landmark, setLandmark] = useState('');
  const [hazardType, setHazardType] = useState('FLOODING');
  const [peopleCount, setPeopleCount] = useState<number>(1);
  const [hasMedicalEmergency, setHasMedicalEmergency] = useState(false);
  const [notes, setNotes] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: 26.8467,
    longitude: 80.9462, // Default to Lucknow Ward 14 focal point
  });
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedBeacon, setSubmittedBeacon] = useState<SosRequest | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch Beacons
  const fetchBeacons = useCallback(async () => {
    try {
      const url = filterStatus !== 'ALL'
        ? `/api/sos?status=${filterStatus}&_t=${Date.now()}`
        : `/api/sos?_t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setBeacons(data.data);
        }
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoadingFeed(false);
    }
  }, [filterStatus]);

  // Initial load and live polling every 4 seconds
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'feed' || tabParam === 'helpline' || tabParam === 'beacon') {
        setActiveTab(tabParam);
      }
    }
    fetchBeacons();
    const interval = setInterval(fetchBeacons, 4000);
    return () => clearInterval(interval);
  }, [fetchBeacons]);

  // Auto-detect GPS
  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setGpsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: Number(pos.coords.latitude.toFixed(5)),
          longitude: Number(pos.coords.longitude.toFixed(5)),
        });
        setGpsDetecting(false);
      },
      (err) => {
        setGpsDetecting(false);
        alert(`Could not acquire GPS: ${err.message}. Using default sector coordinates.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Submit Citizen Beacon
  const handleSubmitBeacon = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        reporterName: reporterName.trim() || 'Citizen in Distress',
        phone: phone.trim() || 'N/A',
        location: coords,
        landmark: landmark.trim() || `Lat: ${coords.latitude}, Lng: ${coords.longitude}`,
        hazardType,
        peopleCount: Number(peopleCount) || 1,
        hasMedicalEmergency,
        notes: notes.trim() || 'Urgent evacuation / rescue required.',
      };

      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSubmittedBeacon(json.data);
        fetchBeacons();
      } else {
        setSubmitError(json.error || 'Failed to transmit SOS emergency beacon.');
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Network error broadcasting distress beacon');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Dispatch Handler for Field Officers
  const handleUpdateStatus = async (beaconId: string, nextStatus: SosRequest['status'], defaultUnit: string) => {
    try {
      const res = await fetch('/api/sos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: beaconId,
          status: nextStatus,
          dispatchedUnit: defaultUnit,
          actorName: 'Tactical Dispatch Officer',
        }),
      });
      if (res.ok) {
        fetchBeacons();
      }
    } catch {
      // Graceful
    }
  };

  const getStatusBadge = (status: SosRequest['status']) => {
    switch (status) {
      case 'PENDING_RESCUE':
        return <span className={`${styles.statusPill} ${styles.statusPending}`}>● Pending Rescue</span>;
      case 'DISPATCHED':
        return <span className={`${styles.statusPill} ${styles.statusDispatched}`}>⚡ Team Dispatched</span>;
      case 'RESCUE_IN_PROGRESS':
        return <span className={`${styles.statusPill} ${styles.statusInProgress}`}>⚓ Rescue Underway</span>;
      case 'RESOLVED_SAFE':
        return <span className={`${styles.statusPill} ${styles.statusResolved}`}>✓ Evacuated & Safe</span>;
      default:
        return <span className={styles.statusPill}>{status}</span>;
    }
  };

  return (
    <div className={styles.page}>
      <Navbar />

      <main className={styles.container}>
        {/* Header Section */}
        <section className={styles.headerSection}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>
              Suraksha Emergency <span>SOS Command</span>
            </h1>
            <p className={styles.subtitle}>
              High-priority citizen distress uplink connected directly to the National Disaster Response Force (NDRF),
              State Disaster Management Authorities (SDMA), and frontline flood evacuation teams.
            </p>
          </div>

          <div className={styles.headerHotlines}>
            <a href="tel:112" className={styles.hotlineBtn} title="National Emergency Hotline">
              🚨 Emergency: 112
            </a>
            <a href="tel:1078" className={styles.secondaryHotlineBtn} title="NDRF Disaster Helpline">
              🛡️ NDRF: 1078
            </a>
            <a href="tel:1070" className={styles.secondaryHotlineBtn} title="State Disaster Management Authority">
              📞 SDMA: 1070
            </a>
          </div>
        </section>

        {/* Navigation Tabs */}
        <nav className={styles.tabNav} aria-label="SOS Navigation">
          <button
            onClick={() => setActiveTab('beacon')}
            className={`${styles.tabBtn} ${activeTab === 'beacon' ? styles.tabBtnActiveBeacon : ''}`}
          >
            🚨 Broadcast Distress Beacon
          </button>
          <button
            onClick={() => setActiveTab('feed')}
            className={`${styles.tabBtn} ${activeTab === 'feed' ? styles.tabBtnActiveFeed : ''}`}
          >
            📡 Live Rescue Stream &amp; Desk ({beacons.length})
          </button>
          <button
            onClick={() => setActiveTab('helpline')}
            className={`${styles.tabBtn} ${activeTab === 'helpline' ? styles.tabBtnActiveGuide : ''}`}
          >
            📋 National Helplines &amp; Directives
          </button>
        </nav>

        {/* Confirmation HUD if a beacon was just submitted */}
        {submittedBeacon && activeTab === 'beacon' && (
          <div className={styles.confirmHud}>
            <div className={styles.confirmHeader}>
              <div>
                <span className={styles.beaconId}>BEACON BROADCASTED #{submittedBeacon.id}</span>
                <h3 className={styles.confirmTitle} style={{ marginTop: '0.5rem' }}>
                  Distress Beacon Successfully Ingested by National Rescue Desk
                </h3>
                <p style={{ color: '#60717B', fontSize: '13.5px', margin: '4px 0 0' }}>
                  Location locked at <strong>{submittedBeacon.landmark}</strong> ({submittedBeacon.location.latitude.toFixed(4)}°N, {submittedBeacon.location.longitude.toFixed(4)}°E).
                  Local emergency response teams have been pinged with priority telemetry.
                </p>
              </div>
              <button
                onClick={() => setSubmittedBeacon(null)}
                style={{
                  background: '#EDF5F8',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '6px 14px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#1F3440',
                }}
              >
                ✕ Dismiss HUD
              </button>
            </div>

            <div className={styles.stepperRow}>
              <div className={`${styles.stepItem} ${styles.stepItemActive}`}>
                <span className={styles.stepNum}>STEP 01</span>
                <span className={styles.stepLabel}>Ingested &amp; Logged</span>
                <span className={styles.stepDesc}>Timestamped &amp; encrypted</span>
              </div>
              <div className={`${styles.stepItem} ${styles.stepItemActive}`}>
                <span className={styles.stepNum}>STEP 02</span>
                <span className={styles.stepLabel}>NDRF Triaged</span>
                <span className={styles.stepDesc}>Assigned severity index</span>
              </div>
              <div className={styles.stepItem}>
                <span className={styles.stepNum}>STEP 03</span>
                <span className={styles.stepLabel}>Unit Dispatched</span>
                <span className={styles.stepDesc}>Boat / evacuation squad</span>
              </div>
              <div className={styles.stepItem}>
                <span className={styles.stepNum}>STEP 04</span>
                <span className={styles.stepLabel}>Safety Extraction</span>
                <span className={styles.stepDesc}>Relief camp arrival</span>
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setActiveTab('feed')}
                style={{
                  background: '#1F3440',
                  color: '#FFFFFF',
                  padding: '8px 18px',
                  borderRadius: '9999px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Track in Rescue Operations Feed →
              </button>
              <Link
                href={`/map?lat=${submittedBeacon.location.latitude}&lng=${submittedBeacon.location.longitude}&zoom=15`}
                style={{
                  background: '#FFFFFF',
                  color: '#1F3440',
                  border: '1.5px solid #C8E3EA',
                  padding: '8px 18px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                Inspect on GIS Map 🗺️
              </Link>
            </div>
          </div>
        )}

        {/* TAB 1: CITIZEN DISTRESS BEACON FORM */}
        {activeTab === 'beacon' && (
          <div className={styles.beaconFormGrid}>
            <div className={styles.formCard}>
              <div className={styles.cardHeader}>
                <h2>Citizen Emergency Distress Transmission</h2>
                <p>
                  Submit immediate coordinates and details for stranded citizens, trapped families, or severe flood hazards.
                </p>
              </div>

              {submitError && (
                <div
                  style={{
                    background: '#FEEFEF',
                    border: '1.5px solid #FCD4D4',
                    color: '#D76D63',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    fontSize: '13.5px',
                    marginBottom: '1.5rem',
                  }}
                >
                  ⚠️ {submitError}
                </div>
              )}

              <form onSubmit={handleSubmitBeacon}>
                {/* Reporter Identity */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '1.5rem' }}>
                  <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.fieldLabel}>
                      Full Name / Contact Person
                      <span className={styles.fieldHint}>Self or bystander</span>
                    </label>
                    <input
                      type="text"
                      className={styles.textInput}
                      placeholder="e.g., Rajesh Kumar / RWA Sector 14"
                      value={reporterName}
                      onChange={(e) => setReporterName(e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.fieldLabel}>
                      Emergency Contact Number
                      <span className={styles.fieldHint}>Active mobile</span>
                    </label>
                    <input
                      type="tel"
                      className={styles.textInput}
                      placeholder="+91 98XXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* GPS Location & Detect Button */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    Incident Landmark / Street Address
                    <span className={styles.fieldHint}>Specific building, ward, or road</span>
                  </label>
                  <div className={styles.gpsBar}>
                    <input
                      type="text"
                      className={styles.textInput}
                      placeholder="e.g., Ward 14, Near Gomti River Bandha, Lucknow"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className={styles.locateBtn}
                      onClick={handleDetectGps}
                      disabled={gpsDetecting}
                    >
                      {gpsDetecting ? 'Detecting...' : '📍 Auto-GPS'}
                    </button>
                  </div>
                  <div className={styles.gpsPill}>
                    🎯 Locked GPS: {coords.latitude}° N, {coords.longitude}° E
                  </div>
                </div>

                {/* Hazard Type & Trapped Count */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '1.5rem' }}>
                  <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.fieldLabel}>Primary Hazard Nature</label>
                    <select
                      className={styles.hazardSelect}
                      value={hazardType}
                      onChange={(e) => setHazardType(e.target.value)}
                    >
                      <option value="FLOODING">Flooding / Water Inundation</option>
                      <option value="FLASH_FLOOD">Flash Flood Surge</option>
                      <option value="LANDSLIDE">Landslide / Mudflow</option>
                      <option value="COLLAPSE">Building / Wall Collapse</option>
                      <option value="ELECTRICAL">Sparking Power Line / Transformer</option>
                    </select>
                  </div>

                  <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                    <label className={styles.fieldLabel}>Persons Stranded</label>
                    <div className={styles.peoplePills}>
                      {[1, 3, 5, 10, 20].map((num) => (
                        <button
                          key={num}
                          type="button"
                          className={`${styles.peopleBtn} ${peopleCount === num ? styles.peopleBtnSelected : ''}`}
                          onClick={() => setPeopleCount(num)}
                        >
                          {num === 20 ? '20+' : num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Medical Emergency Toggle */}
                <label className={styles.medicalBox}>
                  <div className={styles.medicalInfo}>
                    <h4>Critical Medical Assistance Needed</h4>
                    <p>Includes pregnant women, infants, elderly citizens, or oxygen / insulin requirements.</p>
                  </div>
                  <input
                    type="checkbox"
                    className={styles.medicalCheckbox}
                    checked={hasMedicalEmergency}
                    onChange={(e) => setHasMedicalEmergency(e.target.checked)}
                  />
                </label>

                {/* Notes */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    Situation Details &amp; Access Obstacles
                    <span className={styles.fieldHint}>Water depth, roof access, landmarks</span>
                  </label>
                  <textarea
                    rows={3}
                    className={styles.textInput}
                    style={{ resize: 'vertical' }}
                    placeholder="e.g., Water is 4 feet high and rising. Trapped on 1st floor terrace with 2 children. Power is disconnected."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {/* Broadcast Button */}
                <button
                  type="submit"
                  className={styles.broadcastBtn}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    'Transmitting Tactical Beacon...'
                  ) : (
                    <>🚨 TRANSMIT EMERGENCY SOS BEACON NOW</>
                  )}
                </button>
              </form>
            </div>

            {/* Lateral Guidance Deck */}
            <div className={styles.lateralDeck}>
              <div className={styles.tacticalCard}>
                <h3>NDRF Tactical Relay Protocol</h3>
                <div className={styles.ndrfRelayList}>
                  <div className={styles.ndrfRelayItem}>
                    <span className={styles.relayStepNum}>1</span>
                    <div>
                      <strong>Automated Triangulation:</strong> Your coordinates are matched with Doppler radar flood contours and nearest rescue flotillas.
                    </div>
                  </div>
                  <div className={styles.ndrfRelayItem}>
                    <span className={styles.relayStepNum}>2</span>
                    <div>
                      <strong>Unified Command Uplink:</strong> Transmitted simultaneously to NDRF Battalion HQs, District Emergency Centers, and Police Control (112).
                    </div>
                  </div>
                  <div className={styles.ndrfRelayItem}>
                    <span className={styles.relayStepNum}>3</span>
                    <div>
                      <strong>Real-Time Asset Dispatch:</strong> Nearest motorized inflatable boats (IRBs), dewatering crews, or medical responders get routed.
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.tacticalCard} style={{ background: '#EBF4F7', borderColor: '#C8E3EA' }}>
                <h3 style={{ color: '#1F3440', marginBottom: '0.5rem' }}>No Data / Poor Signal?</h3>
                <p style={{ fontSize: '13px', color: '#60717B', lineHeight: '1.55', margin: '0 0 1rem' }}>
                  If your internet connection is dropping, use national SMS or voice helplines immediately.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <a
                    href="tel:112"
                    style={{
                      background: '#1F3440',
                      color: '#FFFFFF',
                      padding: '10px 16px',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: 700,
                      textDecoration: 'none',
                      textAlign: 'center',
                    }}
                  >
                    Dial 112 Emergency Voice
                  </a>
                  <a
                    href="tel:1078"
                    style={{
                      background: '#FFFFFF',
                      color: '#1F3440',
                      border: '1.5px solid #C8E3EA',
                      padding: '10px 16px',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: 600,
                      textDecoration: 'none',
                      textAlign: 'center',
                    }}
                  >
                    Dial 1078 NDRF Control Room
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE RESCUE STREAM & OPERATIONS DESK */}
        {activeTab === 'feed' && (
          <div>
            <div className={styles.feedHeaderRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className={styles.feedCountBadge}>
                  <span className={styles.livePulseDot}></span>
                  {beacons.length} Active Distress Calls Streamed
                </span>
                <span style={{ fontSize: '12px', color: '#8FA2AD' }}>
                  Live auto-refreshing every 4s
                </span>
              </div>

              <div className={styles.filterRow}>
                {['ALL', 'PENDING_RESCUE', 'DISPATCHED', 'RESCUE_IN_PROGRESS', 'RESOLVED_SAFE'].map((status) => (
                  <button
                    key={status}
                    className={`${styles.filterChip} ${filterStatus === status ? styles.filterChipActive : ''}`}
                    onClick={() => setFilterStatus(status)}
                  >
                    {status === 'ALL' ? 'All Incidents' : status.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {loadingFeed && beacons.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 0', color: '#60717B' }}>
                Loading live tactical distress stream...
              </div>
            ) : beacons.length === 0 ? (
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '24px',
                  padding: '4rem 2rem',
                  textAlign: 'center',
                  border: '1px solid #DCEEF2',
                }}
              >
                <span style={{ fontSize: '3rem' }}>🛡️</span>
                <h3 style={{ fontSize: '1.25rem', color: '#1F3440', margin: '1rem 0 0.5rem' }}>
                  No Active Beacons in this Category
                </h3>
                <p style={{ color: '#60717B', fontSize: '14px', margin: 0 }}>
                  All distress requests in this filter have been addressed or resolved.
                </p>
              </div>
            ) : (
              <div className={styles.sosCardsGrid}>
                {beacons.map((beacon) => (
                  <div key={beacon.id} className={styles.sosCard}>
                    <div className={styles.cardTopRow}>
                      <span className={styles.beaconId}>#{beacon.id.slice(-8).toUpperCase()}</span>
                      {getStatusBadge(beacon.status)}
                    </div>

                    <h3 className={styles.sosCardHeadline}>{beacon.landmark}</h3>

                    <div className={styles.sosCardMeta}>
                      <span>📍 {beacon.location.latitude.toFixed(4)}°N, {beacon.location.longitude.toFixed(4)}°E</span>
                      <span>👥 {beacon.peopleCount} Stranded</span>
                      {beacon.hasMedicalEmergency && (
                        <span style={{ color: '#D76D63', fontWeight: 700 }}>
                          🩸 Critical Medical Need
                        </span>
                      )}
                    </div>

                    <p className={styles.sosCardNotes}>
                      &ldquo;{beacon.notes || 'No extra notes provided by reporter.'}&rdquo;
                    </p>

                    <div style={{ fontSize: '12px', color: '#60717B' }}>
                      Reporter: <strong>{beacon.reporterName}</strong> &bull; Contact: <strong>{beacon.phone || 'Private'}</strong>
                    </div>

                    {beacon.dispatchedUnit && (
                      <div className={styles.dispatchedUnitBox}>
                        <span>🚤</span>
                        <div>
                          <div style={{ fontSize: '11px', color: '#4C8DA2', fontWeight: 700 }}>ASSIGNED UNIT</div>
                          <div>{beacon.dispatchedUnit}</div>
                        </div>
                      </div>
                    )}

                    <div className={styles.cardActionRow}>
                      <Link
                        href={`/map?lat=${beacon.location.latitude}&lng=${beacon.location.longitude}&zoom=15`}
                        className={styles.actionMapBtn}
                      >
                        Inspect GIS Map 🗺️
                      </Link>

                      {beacon.status === 'PENDING_RESCUE' && (
                        <button
                          onClick={() => handleUpdateStatus(beacon.id, 'DISPATCHED', 'NDRF Regional Boat Crew (ETA: 10m)')}
                          className={styles.actionDispatchBtn}
                        >
                          Dispatch Unit ⚡
                        </button>
                      )}

                      {beacon.status === 'DISPATCHED' && (
                        <button
                          onClick={() => handleUpdateStatus(beacon.id, 'RESCUE_IN_PROGRESS', beacon.dispatchedUnit || 'Rescue Flotilla')}
                          className={styles.actionDispatchBtn}
                          style={{ background: '#D7AA63' }}
                        >
                          Mark Rescue In Progress ⚓
                        </button>
                      )}

                      {beacon.status === 'RESCUE_IN_PROGRESS' && (
                        <button
                          onClick={() => handleUpdateStatus(beacon.id, 'RESOLVED_SAFE', beacon.dispatchedUnit || 'Rescue Unit')}
                          className={styles.actionDispatchBtn}
                          style={{ background: '#4C8B71' }}
                        >
                          Mark Safe &amp; Evacuated ✓
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: NATIONAL HELPLINES & DIRECTIVES */}
        {activeTab === 'helpline' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div className={styles.formCard}>
              <div className={styles.cardHeader}>
                <h2>National Emergency Numbers (Toll-Free 24/7)</h2>
                <p>Direct lines to central command, disaster relief, and state headquarters.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    background: '#F8FBFC',
                    border: '1px solid #DCEEF2',
                  }}
                >
                  <div>
                    <h4 style={{ margin: '0 0 2px', fontSize: '14px', color: '#1F3440' }}>
                      National Emergency Integrated Helpline
                    </h4>
                    <span style={{ fontSize: '12px', color: '#60717B' }}>Police, Fire, Ambulance Coordination</span>
                  </div>
                  <a
                    href="tel:112"
                    style={{
                      background: '#D76D63',
                      color: '#FFFFFF',
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      fontSize: '13px',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    Dial 112
                  </a>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    background: '#F8FBFC',
                    border: '1px solid #DCEEF2',
                  }}
                >
                  <div>
                    <h4 style={{ margin: '0 0 2px', fontSize: '14px', color: '#1F3440' }}>
                      NDRF HQ Control Room
                    </h4>
                    <span style={{ fontSize: '12px', color: '#60717B' }}>National Disaster Response Force HQ</span>
                  </div>
                  <a
                    href="tel:1078"
                    style={{
                      background: '#1F3440',
                      color: '#FFFFFF',
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      fontSize: '13px',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    Dial 1078
                  </a>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    background: '#F8FBFC',
                    border: '1px solid #DCEEF2',
                  }}
                >
                  <div>
                    <h4 style={{ margin: '0 0 2px', fontSize: '14px', color: '#1F3440' }}>
                      State Disaster Control Room (SDMA)
                    </h4>
                    <span style={{ fontSize: '12px', color: '#60717B' }}>State-Level Emergency Operation Center</span>
                  </div>
                  <a
                    href="tel:1070"
                    style={{
                      background: '#4C8DA2',
                      color: '#FFFFFF',
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      fontSize: '13px',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    Dial 1070
                  </a>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    background: '#F8FBFC',
                    border: '1px solid #DCEEF2',
                  }}
                >
                  <div>
                    <h4 style={{ margin: '0 0 2px', fontSize: '14px', color: '#1F3440' }}>
                      District Disaster Management Authority (DDMA)
                    </h4>
                    <span style={{ fontSize: '12px', color: '#60717B' }}>Local District Collectorate Helpline</span>
                  </div>
                  <a
                    href="tel:1077"
                    style={{
                      background: '#1F3440',
                      color: '#FFFFFF',
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      fontSize: '13px',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    Dial 1077
                  </a>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    background: '#F8FBFC',
                    border: '1px solid #DCEEF2',
                  }}
                >
                  <div>
                    <h4 style={{ margin: '0 0 2px', fontSize: '14px', color: '#1F3440' }}>
                      Emergency Ambulance Service
                    </h4>
                    <span style={{ fontSize: '12px', color: '#60717B' }}>Medical Transport &amp; Paramedic Flotilla</span>
                  </div>
                  <a
                    href="tel:108"
                    style={{
                      background: '#D76D63',
                      color: '#FFFFFF',
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      fontSize: '13px',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    Dial 108
                  </a>
                </div>
              </div>
            </div>

            <div className={styles.formCard}>
              <div className={styles.cardHeader}>
                <h2>Flood &amp; Inundation Safety Directives</h2>
                <p>Standard Operating Procedures published by NDMA for civilian survival.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.25rem' }}>⚡</span>
                  <div>
                    <strong style={{ fontSize: '13.5px', color: '#1F3440', display: 'block', marginBottom: '2px' }}>
                      Disconnect Main Electrical Switches
                    </strong>
                    <span style={{ fontSize: '12.5px', color: '#60717B', lineHeight: '1.5' }}>
                      Turn off circuit breakers and gas supplies before water enters your premises. Never touch wet electrical panels.
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.25rem' }}>🚗</span>
                  <div>
                    <strong style={{ fontSize: '13.5px', color: '#1F3440', display: 'block', marginBottom: '2px' }}>
                      Never Drive Through Waterlogged Underpasses
                    </strong>
                    <span style={{ fontSize: '12.5px', color: '#60717B', lineHeight: '1.5' }}>
                      Just 6 inches of rapid moving water can knock down an adult; 2 feet of water will float away most vehicles.
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.25rem' }}>🏠</span>
                  <div>
                    <strong style={{ fontSize: '13.5px', color: '#1F3440', display: 'block', marginBottom: '2px' }}>
                      Move Upwards to Concrete Rooftops
                    </strong>
                    <span style={{ fontSize: '12.5px', color: '#60717B', lineHeight: '1.5' }}>
                      Take drinking water bottles, emergency torches, battery packs, and prescription medications to highest elevated floor.
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.25rem' }}>🚰</span>
                  <div>
                    <strong style={{ fontSize: '13.5px', color: '#1F3440', display: 'block', marginBottom: '2px' }}>
                      Boil or Purify All Water
                    </strong>
                    <span style={{ fontSize: '12.5px', color: '#60717B', lineHeight: '1.5' }}>
                      Tap and municipal water may be mixed with sewer overflow during heavy inundation. Drink only packaged or boiled water.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
