'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './alertWorkflow.module.css';

interface WorkflowStep {
  number: string;
  phaseTag: string;
  headline: string;
  description: string;
  mockBadge: string;
  mockBadgeType: 'info' | 'warning' | 'verified' | 'critical';
  hudMetrics: Array<{ label: string; value: string }>;
  actorNote: string;
  visualIcon: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    number: '01',
    phaseTag: 'GROUND INGESTION',
    headline: 'A citizen submits a local hazard report in under 60 seconds.',
    description:
      'Using GPS positioning and lightweight photo compression (<150KB), an eyewitness records standing water, fallen powerlines, or cloudburst inundation. Offline buffering guarantees zero data loss even in low-cellular zones.',
    mockBadge: 'Citizen Ground Truth',
    mockBadgeType: 'info',
    hudMetrics: [
      { label: 'COORDINATES', value: '26.851°N, 80.998°E' },
      { label: 'H3 RESOLUTION', value: 'Hex 882a0e81bf91fff' },
      { label: 'WATER DEPTH', value: '3.5 ft (Waist Level)' },
      { label: 'INGEST STATUS', value: 'Buffered & Received' },
    ],
    actorNote: 'Eyewitness observation captured at Gomti Nagar Underpass, Lucknow.',
    visualIcon: '📍',
  },
  {
    number: '02',
    phaseTag: 'METEOROLOGICAL CORRELATION',
    headline: 'Weather signals and nearby reports cross-validate the event.',
    description:
      'The Suraksha Setu correlation engine queries dual-polarization Doppler radar sweeps and nearby automatic rain gauges. Clustering algorithms analyze spatial proximity across adjacent H3 cells to detect true flood boundaries.',
    mockBadge: 'Doppler Corroborated',
    mockBadgeType: 'warning',
    hudMetrics: [
      { label: 'DOPPLER REFLECTIVITY', value: '48.5 dBZ Core' },
      { label: 'AWS RAIN RATE', value: '42.0 mm/h Echo' },
      { label: 'SPATIAL CLUSTER', value: '4 Nearby Reports' },
      { label: 'ALGORITHM CONFIDENCE', value: '94% Corroborated' },
    ],
    actorNote: 'Doppler S-band echo confirms heavy cloudburst precipitation over the basin.',
    visualIcon: '📡',
  },
  {
    number: '03',
    phaseTag: 'HUMAN-IN-THE-LOOP VERIFICATION',
    headline: 'A duty reviewer verifies and authorizes the incident.',
    description:
      'Zero automated panic broadcasts. Certified IMD meteorologists and municipal emergency officers inspect ground camera photos, examine radar signatures, and assign targeted tactical directives with full audit logging.',
    mockBadge: 'Verified Genuine',
    mockBadgeType: 'verified',
    hudMetrics: [
      { label: 'REVIEW OFFICER', value: 'Duty Officer S. Verma' },
      { label: 'COMMAND POST', value: 'Disaster Triage Centre' },
      { label: 'DECISION', value: 'Verified Genuine' },
      { label: 'MUNICIPAL ORDER', value: 'Dewatering Crew #4B' },
    ],
    actorNote: 'Incident escalated to Emergency Operations Centre. Dispatch order confirmed.',
    visualIcon: '🛡️',
  },
  {
    number: '04',
    phaseTag: 'PUBLIC SAFETY BROADCAST',
    headline: 'A local public alert is published live on the risk map.',
    description:
      'A geo-fenced CAP 1.2 warning is broadcast to the affected H3 hexagon zone. Citizens receive avoidance route recommendations, emergency helpline contacts, and live progress tracking until the corridor is restored.',
    mockBadge: 'CAP 1.2 Directive',
    mockBadgeType: 'critical',
    hudMetrics: [
      { label: 'TARGET ZONE', value: 'Gomti Nagar Sector 4' },
      { label: 'DIRECTIVE', value: 'Avoid Underpass' },
      { label: 'DETOUR ROUTE', value: 'Lohia Path Open' },
      { label: 'MAP STATUS', value: 'Live on Radar Map' },
    ],
    actorNote: 'All-clear guidance published as municipal high-capacity pumps lower water level.',
    visualIcon: '📢',
  },
];

export function AlertWorkflowSequence() {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Gentle auto-rotation through the 4 steps unless user is hovering / interacting
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveStepIndex((prev) => (prev + 1) % WORKFLOW_STEPS.length);
    }, 6500);
    return () => clearInterval(interval);
  }, [isPaused]);

  const step = WORKFLOW_STEPS[activeStepIndex];

  return (
    <section
      className={styles.workflowSection}
      id="how-it-works"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className={styles.sectionContainer}>
        {/* Editorial Chapter Header */}
        <div className={styles.sectionHeader}>
          <span className={styles.kicker}>THE VERIFICATION LIFECYCLE</span>
          <h2 className={styles.title}>How Hyperlocal Alerts Are Verified &amp; Broadcast</h2>
          <p className={styles.subtitle}>
            From street-level eyewitness report to multi-sensor radar cross-check and official municipal sign-off.
            Zero automated panic alerts — every warning is grounded in physical telemetry and certified authority.
          </p>
        </div>

        {/* Step Progression Tabs */}
        <div className={styles.stepTabs}>
          {WORKFLOW_STEPS.map((s, idx) => {
            const isActive = idx === activeStepIndex;
            return (
              <button
                key={s.number}
                type="button"
                className={`${styles.stepTab} ${isActive ? styles.stepTabActive : ''}`}
                onClick={() => {
                  setActiveStepIndex(idx);
                  setIsPaused(true);
                }}
              >
                <div className={styles.tabNumberRow}>
                  <span className={styles.tabNumber}>{s.number}</span>
                  <span className={styles.tabIcon}>{s.visualIcon}</span>
                </div>
                <div className={styles.tabTitle}>{s.phaseTag}</div>
                {isActive && <div className={styles.tabProgressBar} />}
              </button>
            );
          })}
        </div>

        {/* Dynamic Chapter Content & Interactive HUD */}
        <div className={styles.editorialStage}>
          {/* Left Narrative Column */}
          <div className={styles.narrativeColumn}>
            <div className={styles.phaseIndicator}>
              <span className={styles.phaseDot} />
              <span>CHAPTER {step.number} OF 04 · {step.phaseTag}</span>
            </div>

            <h3 className={styles.stepHeadline}>{step.headline}</h3>
            <p className={styles.stepDescription}>{step.description}</p>

            <div className={styles.actorNoteBox}>
              <div className={styles.actorNoteTitle}>Operational Dispatch Note:</div>
              <p className={styles.actorNoteText}>{step.actorNote}</p>
            </div>

            <div className={styles.stepNavControls}>
              <button
                type="button"
                className={styles.stepNavBtn}
                onClick={() => setActiveStepIndex((prev) => (prev - 1 + WORKFLOW_STEPS.length) % WORKFLOW_STEPS.length)}
                aria-label="Previous step"
              >
                ← Previous Stage
              </button>
              <button
                type="button"
                className={`${styles.stepNavBtn} ${styles.stepNavBtnPrimary}`}
                onClick={() => setActiveStepIndex((prev) => (prev + 1) % WORKFLOW_STEPS.length)}
                aria-label="Next step"
              >
                Next Stage ({activeStepIndex + 1}/4) →
              </button>
            </div>
          </div>

          {/* Right Tactile Telemetry HUD Card with H3 Hexagon Graphic */}
          <div className={styles.hudCardColumn}>
            <div className={styles.hudCard}>
              {/* HUD Header */}
              <div className={styles.hudHeader}>
                <div className={styles.hudTitleGroup}>
                  <span className={styles.hudBadge} data-type={step.mockBadgeType}>
                    {step.mockBadge}
                  </span>
                  <span className={styles.hudStationText}>LKO-DOPPLER · NODE 04B</span>
                </div>
                <div className={styles.hudStatusDot} />
              </div>

              {/* H3 Hexagonal Risk Geometry Visualizer */}
              <div className={styles.h3HexViewport}>
                <svg
                  className={styles.h3Svg}
                  viewBox="0 0 280 180"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Background Grid Lines */}
                  <line x1="20" y1="90" x2="260" y2="90" stroke="rgba(56, 189, 248, 0.12)" strokeDasharray="3 4" />
                  <line x1="140" y1="20" x2="140" y2="160" stroke="rgba(56, 189, 248, 0.12)" strokeDasharray="3 4" />

                  {/* Concentric Signal Rings */}
                  <circle
                    cx="140"
                    cy="90"
                    r={activeStepIndex >= 1 ? '58' : '36'}
                    stroke="rgba(56, 189, 248, 0.25)"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                    className={styles.radarRingPulse}
                  />

                  {/* Central H3 Hexagon Zone */}
                  <polygon
                    points="140,48 180,70 180,110 140,132 100,110 100,70"
                    className={`${styles.h3Polygon} ${activeStepIndex === 3 ? styles.h3PolygonCritical : activeStepIndex >= 2 ? styles.h3PolygonVerified : ''}`}
                  />

                  {/* Incident Center Dot */}
                  <circle
                    cx="140"
                    cy="90"
                    r="4.5"
                    fill={activeStepIndex === 3 ? '#EF4444' : activeStepIndex >= 2 ? '#34D399' : '#38BDF8'}
                    className={styles.incidentCenterDot}
                  />

                  {/* Telemetry Labels */}
                  <text x="140" y="38" textAnchor="middle" fill="#8A99A8" fontSize="9" fontFamily="monospace">
                    H3 RES-8 CELL
                  </text>
                  <text
                    x="140"
                    y="152"
                    textAnchor="middle"
                    fill={activeStepIndex === 3 ? '#FCA5A5' : '#7DD3FC'}
                    fontSize="9.5"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {activeStepIndex === 0
                      ? 'OBSERVATION PINNED'
                      : activeStepIndex === 1
                      ? 'RADAR CLUSTER 52 dBZ'
                      : activeStepIndex === 2
                      ? 'AUTHORITY SIGNED'
                      : 'CAP 1.2 BROADCAST LIVE'}
                  </text>
                </svg>
              </div>

              {/* HUD Telemetry Metric Grid */}
              <div className={styles.hudGrid}>
                {step.hudMetrics.map((m, idx) => (
                  <div key={idx} className={styles.hudMetricItem}>
                    <span className={styles.hudLabel}>{m.label}</span>
                    <span className={styles.hudValue}>{m.value}</span>
                  </div>
                ))}
              </div>

              {/* HUD Footer Directives */}
              <div className={styles.hudFooter}>
                <div className={styles.hudFooterText}>
                  <span>Suraksha Setu National Protocol Compliance</span>
                  <span>IMD · NDMA · MoES Standard</span>
                </div>
                <Link href="/map" className={styles.hudInspectBtn}>
                  Inspect Live Map →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Calm Operational Call-to-Action */}
        <div className={styles.operationalCta}>
          <div className={styles.ctaCard}>
            <div className={styles.ctaCopy}>
              <h3 className={styles.ctaTitle}>Ready to monitor your local risk corridor?</h3>
              <p className={styles.ctaDescription}>
                Access real-time ground truth across Lucknow and 45 national Doppler radar basins, or submit an eyewitness hazard observation in your neighborhood.
              </p>
            </div>
            <div className={styles.ctaButtons}>
              <Link href="/map" className={styles.ctaPrimary}>
                <span>View Your Local Risk</span>
                <span className={styles.ctaArrow}>→</span>
              </Link>
              <Link href="/report" className={styles.ctaSecondary}>
                <span>Report a Hazard</span>
                <span className={styles.ctaArrow}>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
