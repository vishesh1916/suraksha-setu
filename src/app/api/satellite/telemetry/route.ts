import { NextRequest, NextResponse } from 'next/server';
import type { SatelliteObservation } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const isoNow = now.toISOString();
    const tenMinAgo = new Date(now.getTime() - 10 * 60000).toISOString();
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60000).toISOString();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60000).toISOString();

    const observations: SatelliteObservation[] = [
      {
        id: 'sat_isro_insat3dr_delhi',
        agency: 'ISRO',
        satellite: 'INSAT-3DR (82°E Geostationary)',
        sensor: 'Multi-Spectral Imager (TIR-1 & WV)',
        productName: 'Rapid Scan Convective Cloud Cluster & Cloud Top Temperature',
        timestamp: tenMinAgo,
        coverageRegion: 'Indo-Gangetic Basin — NCT Delhi / Haryana',
        coordinates: { latitude: 28.6139, longitude: 77.2090 },
        spectralBand: 'Thermal Infrared (10.8 µm) & Water Vapor (6.7 µm)',
        resolutionMeters: 4000,
        parameters: {
          cloudTopTempC: -59.4,
          cloudTopHeightKm: 13.2,
          rainRateEstimateMmH: 52.8,
          reflectivityDbz: 46.5,
          convectiveIndex: 'SEVERE_SQUALL_CELL',
          soilSaturationPct: 88,
        },
        summary: 'ISRO INSAT-3DR Rapid Scan corroborates deep convective cumulonimbus plume over Delhi-NCR. Cloud top temperatures dropped to -59.4°C indicative of severe localized downpours exceeding 50 mm/hr.',
        directTelemetryLink: 'https://www.mosdac.gov.in',
        status: 'RAPID_SCAN',
      },
      {
        id: 'sat_isro_insat3dr_mumbai',
        agency: 'ISRO',
        satellite: 'INSAT-3DR (82°E Geostationary)',
        sensor: 'Sounder & Imager TIR-2',
        productName: 'Offshore Convective Cloud Wall & High Tide Moisture Surge',
        timestamp: fifteenMinAgo,
        coverageRegion: 'Konkan Coast — Mumbai Metropolitan Region / Arabian Sea',
        coordinates: { latitude: 19.0760, longitude: 72.8777 },
        spectralBand: 'Thermal Infrared (12.0 µm) & Visible (0.65 µm)',
        resolutionMeters: 4000,
        parameters: {
          cloudTopTempC: -63.1,
          cloudTopHeightKm: 14.5,
          rainRateEstimateMmH: 41.2,
          reflectivityDbz: 44.0,
          convectiveIndex: 'COASTAL_CONVECTIVE_SURGE',
          soilSaturationPct: 92,
        },
        summary: 'INSAT-3DR Sounder shows high moisture flux convergence along North Konkan coast coinciding with spring high tide. Cloud top height peaked at 14.5 km with intense oceanic squall lines.',
        directTelemetryLink: 'https://bhuvan.nrsc.gov.in',
        status: 'REALTIME',
      },
      {
        id: 'sat_nasa_gpm_imerg_india',
        agency: 'NASA',
        satellite: 'GPM Core Observatory (NASA / JAXA)',
        sensor: 'DPR (Dual-frequency Precipitation Radar) & GMI Microwave',
        productName: 'IMERG Half-Hourly Calibrated Rain Rate (V07B)',
        timestamp: thirtyMinAgo,
        coverageRegion: 'Pan-India Subcontinent Composite',
        coordinates: { latitude: 20.5937, longitude: 78.9629 },
        spectralBand: 'Ka/Ku Dual Radar (13.6 GHz & 35.5 GHz)',
        resolutionMeters: 10000,
        parameters: {
          rainRateEstimateMmH: 38.6,
          reflectivityDbz: 43.2,
          convectiveIndex: 'MONSOON_TROUGH_INTENSIFICATION',
          soilSaturationPct: 84,
        },
        summary: 'NASA GPM IMERG microwave radar sweeps confirm active monsoon shear zone spanning central and northern river basins with instantaneous peak precipitation rates above 40 mm/hr.',
        directTelemetryLink: 'https://gibs.earthdata.nasa.gov',
        status: 'CALIBRATED',
      },
      {
        id: 'sat_isro_bhuvan_assam',
        agency: 'ISRO',
        satellite: 'EOS-04 (Radar Imaging Satellite RISAT-1A) & Cartosat',
        sensor: 'C-band Synthetic Aperture Radar (SAR)',
        productName: 'Bhuvan Flood Inundation & Embankment Vulnerability Map',
        timestamp: fifteenMinAgo,
        coverageRegion: 'Brahmaputra Valley — Guwahati / Kamrup',
        coordinates: { latitude: 26.1445, longitude: 91.7362 },
        spectralBand: 'SAR C-Band (5.4 GHz Polarimetric)',
        resolutionMeters: 250,
        parameters: {
          cloudTopTempC: -48.0,
          soilSaturationPct: 96,
          convectiveIndex: 'RIVERINE_BREACH_ALERT',
        },
        summary: 'ISRO NRSC Bhuvan Disaster Watch: Synthetic Aperture Radar penetrates heavy cloud overcast, delineating 1,480 sq km of waterlogged floodplain along the Brahmaputra corridor.',
        directTelemetryLink: 'https://bhuvan-app1.nrsc.gov.in/disaster',
        status: 'REALTIME',
      },
      {
        id: 'sat_isro_insat3d_himalayas',
        agency: 'ISRO',
        satellite: 'INSAT-3D (74°E Geostationary)',
        sensor: 'Imager Water Vapor Channel (6.8 µm)',
        productName: 'Western Himalayan Cloudburst & Orographic Lift Sentinel',
        timestamp: tenMinAgo,
        coverageRegion: 'Himachal Pradesh & Uttarakhand Upper Catchments',
        coordinates: { latitude: 32.2190, longitude: 76.3234 },
        spectralBand: 'Middle Tropospheric Water Vapor (6.8 µm)',
        resolutionMeters: 4000,
        parameters: {
          cloudTopTempC: -67.2,
          cloudTopHeightKm: 15.1,
          rainRateEstimateMmH: 68.4,
          reflectivityDbz: 51.0,
          convectiveIndex: 'EXTREME_OROGRAPHIC_BURST',
          soilSaturationPct: 91,
        },
        summary: 'Severe orographic uplift triggered deep convective core over Kangra valley slopes with Cloud Top Temperature dropping to -67.2°C. High probability of flash debris flows along steep river valleys.',
        directTelemetryLink: 'https://www.mosdac.gov.in',
        status: 'RAPID_SCAN',
      },
    ];

    return NextResponse.json(
      {
        success: true,
        uplink: {
          status: 'SYNCHRONIZED',
          groundStation: 'ISRO MOSDAC SAC Ahmedabad / NRSC Shadnagar & NASA EOSDIS',
          orbitalLatencySec: 42,
          nextRapidScanSec: 180,
          activeConstellations: ['ISRO INSAT-3DR', 'ISRO INSAT-3D', 'ISRO EOS-04 RISAT', 'NASA GPM Core', 'NASA Suomi-NPP VIIRS'],
        },
        count: observations.length,
        data: observations,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve satellite space telemetry' },
      { status: 500 }
    );
  }
}
