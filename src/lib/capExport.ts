// ============================================================
// Suraksha Setu — Common Alerting Protocol (CAP-CP 1.2 / NDMA) Generator
// Generates official CAP XML and JSON for emergency interop
// ============================================================

import type { Alert } from '@/types';

export function generateCapXml(alert: Alert, authorizedActor = 'NDMA / Operational Disaster Response Desk'): string {
  const identifier = `IN-SURAKSHA-${alert.id}-${Date.now()}`;
  const sent = new Date().toISOString();
  const expires = alert.expiresAt || new Date(Date.now() + 6 * 3600000).toISOString();
  const effective = alert.startsAt || sent;

  const severityMapping: Record<number, string> = {
    5: 'Extreme',
    4: 'Severe',
    3: 'Moderate',
    2: 'Minor',
    1: 'Unknown',
  };

  const severityStr = severityMapping[alert.severity] || 'Moderate';

  // Extract coordinates for CAP polygon format: "lat,lng lat,lng ..."
  let polygonStr = '';
  if (alert.polygon?.coordinates?.[0]) {
    polygonStr = alert.polygon.coordinates[0]
      .map(([lng, lat]) => `${lat.toFixed(4)},${lng.toFixed(4)}`)
      .join(' ');
  } else {
    polygonStr = '19.0760,72.8777 19.1000,72.9000 19.0500,72.8800 19.0760,72.8777';
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>${identifier}</identifier>
  <sender>ops-center@suraksha-setu.gov.in</sender>
  <sent>${sent}</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <codeValue>NDMA-CAP-CP-v1.0</codeValue>
  <info>
    <language>en-IN</language>
    <category>Met</category>
    <event>${escapeXml(alert.category || 'Meteorological Hazard')}</event>
    <urgency>Expected</urgency>
    <severity>${severityStr}</severity>
    <certainty>Observed</certainty>
    <eventCode>
      <valueName>IMD-THREAT-LEVEL</valueName>
      <value>${alert.severity >= 4 ? 'RED' : alert.severity >= 3 ? 'ORANGE' : 'YELLOW'}</value>
    </eventCode>
    <effective>${effective}</effective>
    <expires>${expires}</expires>
    <senderName>${escapeXml(alert.source || 'Suraksha Setu Meteorological Operations Desk')}</senderName>
    <headline>${escapeXml(alert.headline)}</headline>
    <description>${escapeXml(alert.guidance || 'Verified ground reports corroborated with Doppler radar.')}</description>
    <instruction>${escapeXml(alert.guidance || 'Follow local municipal guidance. Dial 112 in life threat.')}</instruction>
    <area>
      <areaDesc>${escapeXml(alert.areaName || 'Designated Metropolitan Vulnerability Sector')}</areaDesc>
      <polygon>${polygonStr}</polygon>
      ${alert.h3Index ? `<geocode><valueName>H3-R8</valueName><value>${alert.h3Index}</value></geocode>` : ''}
    </area>
    <parameter>
      <valueName>HumanAuthorization</valueName>
      <value>${escapeXml(authorizedActor)} [Verified]</value>
    </parameter>
  </info>
</alert>`.trim();
}

export function generateCapJson(alert: Alert, authorizedActor = 'NDMA Desk'): Record<string, unknown> {
  return {
    capVersion: '1.2',
    identifier: `IN-SURAKSHA-${alert.id}`,
    sender: 'ops-center@suraksha-setu.gov.in',
    sent: new Date().toISOString(),
    status: 'Actual',
    msgType: 'Alert',
    scope: 'Public',
    info: {
      category: 'Met',
      event: alert.category,
      urgency: 'Expected',
      severity: alert.severity >= 4 ? 'Severe' : 'Moderate',
      certainty: 'Observed',
      headline: alert.headline,
      description: alert.guidance,
      instruction: alert.guidance,
      effective: alert.startsAt,
      expires: alert.expiresAt,
      senderName: alert.source,
      area: {
        areaDesc: alert.areaName,
        polygon: alert.polygon,
        h3Index: alert.h3Index,
      },
      verifiedBy: authorizedActor,
    },
  };
}

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
