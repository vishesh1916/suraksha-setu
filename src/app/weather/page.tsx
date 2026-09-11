'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { translations, getSavedLanguage, type Language } from '@/lib/i18n';
import styles from './weather.module.css';

interface WeatherData {
  location: {
    name: string;
    state: string;
    latitude: number;
    longitude: number;
  };
  telemetry: {
    temperature: number;
    apparentTemperature: number;
    relativeHumidity: number;
    precipitationRate: number;
    rain: number;
    surfacePressure: number;
    windSpeed: number;
    windGusts: number;
    cloudCover: number;
    uvIndex: number;
    weatherCode: number;
    threatLevel: 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL';
    threatDescription: string;
    updatedAt: string;
  };
  hourly: Array<{
    time: string;
    hour: string;
    temp: number;
    precip: number;
    precipProb: number;
    windSpeed: number;
  }>;
  daily: Array<{
    date: string;
    dayName: string;
    tempMax: number;
    tempMin: number;
    precipSum: number;
    precipProbMax: number;
  }>;
}

const INDIAN_STATES_SUMMARY = [
  { name: 'Maharashtra', capital: 'Mumbai', zone: 'West', threat: 'WATCH', rain: '8.4 mm/h' },
  { name: 'Delhi NCR', capital: 'New Delhi', zone: 'North', threat: 'WATCH', rain: '6.2 mm/h' },
  { name: 'Tamil Nadu', capital: 'Chennai', zone: 'South', threat: 'WARNING', rain: '14.1 mm/h' },
  { name: 'Karnataka', capital: 'Bengaluru', zone: 'South', threat: 'NORMAL', rain: '1.2 mm/h' },
  { name: 'West Bengal', capital: 'Kolkata', zone: 'East', threat: 'WATCH', rain: '5.0 mm/h' },
  { name: 'Assam', capital: 'Guwahati', zone: 'North-East', threat: 'WARNING', rain: '18.6 mm/h' },
  { name: 'Himachal Pradesh', capital: 'Shimla', zone: 'North', threat: 'WARNING', rain: '16.5 mm/h' },
  { name: 'Uttarakhand', capital: 'Dehradun', zone: 'North', threat: 'WATCH', rain: '7.8 mm/h' },
  { name: 'Kerala', capital: 'Kochi', zone: 'South', threat: 'WATCH', rain: '9.3 mm/h' },
  { name: 'Odisha', capital: 'Bhubaneswar', zone: 'East', threat: 'WATCH', rain: '4.7 mm/h' },
  { name: 'Bihar', capital: 'Patna', zone: 'East', threat: 'NORMAL', rain: '0.8 mm/h' },
  { name: 'Gujarat', capital: 'Ahmedabad', zone: 'West', threat: 'NORMAL', rain: '0.0 mm/h' },
  { name: 'Rajasthan', capital: 'Jaipur', zone: 'West', threat: 'NORMAL', rain: '0.0 mm/h' },
  { name: 'Madhya Pradesh', capital: 'Bhopal', zone: 'Central', threat: 'NORMAL', rain: '0.2 mm/h' },
  { name: 'Telangana', capital: 'Hyderabad', zone: 'South', threat: 'NORMAL', rain: '1.0 mm/h' },
  { name: 'Uttar Pradesh', capital: 'Lucknow', zone: 'North', threat: 'WATCH', rain: '3.5 mm/h' },
  { name: 'Punjab', capital: 'Chandigarh', zone: 'North', threat: 'NORMAL', rain: '0.0 mm/h' },
  { name: 'Jammu & Kashmir', capital: 'Srinagar', zone: 'North', threat: 'WATCH', rain: '4.2 mm/h' },
  { name: 'Meghalaya', capital: 'Shillong', zone: 'North-East', threat: 'CRITICAL', rain: '28.0 mm/h' },
  { name: 'Goa', capital: 'Panaji', zone: 'West', threat: 'WARNING', rain: '13.5 mm/h' },
  { name: 'Andhra Pradesh', capital: 'Visakhapatnam', zone: 'South', threat: 'NORMAL', rain: '2.1 mm/h' },
  { name: 'Jharkhand', capital: 'Ranchi', zone: 'East', threat: 'NORMAL', rain: '0.5 mm/h' },
  { name: 'Chhattisgarh', capital: 'Raipur', zone: 'Central', threat: 'NORMAL', rain: '0.0 mm/h' },
  { name: 'Tripura', capital: 'Agartala', zone: 'North-East', threat: 'WATCH', rain: '5.2 mm/h' },
];

export default function AllIndiaWeatherPage() {
  const [lang, setLang] = useState<Language>('en');
  const [searchQuery, setSearchQuery] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLang(getSavedLanguage());
    const onLangChange = (e: Event) => {
      const customEvent = e as CustomEvent<Language>;
      if (customEvent.detail) setLang(customEvent.detail);
    };
    window.addEventListener('languagechange', onLangChange);
    return () => window.removeEventListener('languagechange', onLangChange);
  }, []);

  const t = translations[lang].weather;

  const fetchWeather = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/weather/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to load weather data');
      } else {
        setWeather(data);
      }
    } catch {
      setError('Connection to meteorological network interrupted. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather('Delhi NCR');
  }, [fetchWeather]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      fetchWeather(searchQuery.trim());
    }
  };

  return (
    <div className={styles.page}>
      <Navbar />

      <main className={styles.container}>
        {/* Search Banner */}
        <section className={styles.searchBanner}>
          <div className={styles.badge}>
            <span>📡</span> 0-API-Key Open Meteorological Feed · Pan-India Real-Time
          </div>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>

          <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="weather-search-input"
            />
            <button type="submit" className={styles.searchBtn} id="weather-search-btn">
              <span>🔍</span>
              <span>Search</span>
            </button>
          </form>

          <div className={styles.quickHubs}>
            <span className={styles.quickHubsLabel}>Quick Telemetry Hubs:</span>
            {[
              'Delhi NCR',
              'Mumbai',
              'Bengaluru',
              'Chennai',
              'Kolkata',
              'Guwahati',
              'Shimla',
              'Patna',
              'Kochi',
              'Shillong',
            ].map((hub) => (
              <button
                key={hub}
                type="button"
                className={styles.hubChip}
                onClick={() => {
                  setSearchQuery(hub);
                  fetchWeather(hub);
                }}
              >
                {hub}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
            <span>⚠️</span> {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div className="spinner spinner-lg" />
            <p style={{ marginTop: 16, color: '#8A99A8' }}>
              Interrogating Doppler radar stations & satellite models…
            </p>
          </div>
        )}

        {/* Telemetry Display */}
        {weather && !loading && (
          <>
            <div className={styles.activeHeroCard}>
              <div className={styles.heroHeader}>
                <div>
                  <h2 className={styles.locationTitle}>
                    📍 {weather.location.name}, {weather.location.state}
                  </h2>
                  <div className={styles.locationMeta}>
                    Coordinates: {weather.location.latitude.toFixed(4)}°N,{' '}
                    {weather.location.longitude.toFixed(4)}°E · Updated{' '}
                    {new Date(weather.telemetry.updatedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                <div
                  className={`${styles.threatBadge} ${styles[`threat${weather.telemetry.threatLevel}`]}`}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'currentColor',
                    }}
                  />
                  <span>
                    {weather.telemetry.threatLevel === 'CRITICAL'
                      ? t.threatCritical
                      : weather.telemetry.threatLevel === 'WARNING'
                      ? t.threatWarning
                      : weather.telemetry.threatLevel === 'WATCH'
                      ? t.threatWatch
                      : t.threatNormal}
                  </span>
                </div>
              </div>

              {/* Telemetry Grid */}
              <div className={styles.telemetryGrid}>
                <div className={styles.metricTile}>
                  <span className={styles.metricTileLabel}>Temperature</span>
                  <span className={styles.metricTileValue}>
                    {weather.telemetry.temperature}°C
                  </span>
                  <span className={styles.metricTileSub}>
                    Feels like {weather.telemetry.apparentTemperature}°C
                  </span>
                </div>

                <div className={styles.metricTile}>
                  <span className={styles.metricTileLabel}>{t.rainRate}</span>
                  <span
                    className={styles.metricTileValue}
                    style={{
                      color:
                        weather.telemetry.precipitationRate > 12 ? '#EF4444' : '#38BDF8',
                    }}
                  >
                    {weather.telemetry.precipitationRate} mm/h
                  </span>
                  <span className={styles.metricTileSub}>
                    Accumulated rain: {weather.telemetry.rain} mm
                  </span>
                </div>

                <div className={styles.metricTile}>
                  <span className={styles.metricTileLabel}>{t.windSpeed}</span>
                  <span className={styles.metricTileValue}>
                    {weather.telemetry.windSpeed} km/h
                  </span>
                  <span className={styles.metricTileSub}>
                    Gusts up to {weather.telemetry.windGusts} km/h
                  </span>
                </div>

                <div className={styles.metricTile}>
                  <span className={styles.metricTileLabel}>{t.humidity}</span>
                  <span className={styles.metricTileValue}>
                    {weather.telemetry.relativeHumidity}%
                  </span>
                  <span className={styles.metricTileSub}>Moisture saturation</span>
                </div>

                <div className={styles.metricTile}>
                  <span className={styles.metricTileLabel}>{t.pressure}</span>
                  <span className={styles.metricTileValue}>
                    {weather.telemetry.surfacePressure} hPa
                  </span>
                  <span className={styles.metricTileSub}>Atmospheric gradient</span>
                </div>

                <div className={styles.metricTile}>
                  <span className={styles.metricTileLabel}>UV & Cloud Index</span>
                  <span className={styles.metricTileValue}>
                    UV {weather.telemetry.uvIndex}
                  </span>
                  <span className={styles.metricTileSub}>
                    {weather.telemetry.cloudCover}% cloud density
                  </span>
                </div>
              </div>

              {/* Threat Statement */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  padding: '12px 16px',
                  fontSize: 13,
                  color: '#CBD5E1',
                }}
              >
                <strong>Operational Assessment:</strong>{' '}
                {weather.telemetry.threatDescription}
              </div>
            </div>

            {/* 24-Hour Hourly Trend */}
            <h3 className={styles.sectionTitle}>
              <span>⏱️</span> 24-Hour Precipitation & Temperature Projection
            </h3>
            <div className={styles.hourlyStrip}>
              {weather.hourly.map((h, i) => (
                <div key={i} className={styles.hourCard}>
                  <span className={styles.hourTime}>{h.hour}</span>
                  <span className={styles.hourTemp}>{Math.round(h.temp)}°C</span>
                  <span className={styles.hourPrecip}>
                    🌧️ {h.precip > 0 ? `${h.precip}mm` : `${h.precipProb}%`}
                  </span>
                </div>
              ))}
            </div>

            {/* 7-Day Outlook */}
            <h3 className={styles.sectionTitle}>
              <span>📅</span> 7-Day Meteorological Outlook
            </h3>
            <div className={styles.dailyGrid}>
              {weather.daily.map((d, i) => (
                <div key={i} className={styles.dayCard}>
                  <div className={styles.dayName}>{d.dayName}</div>
                  <div>
                    <span className={styles.dayTempHigh}>{Math.round(d.tempMax)}°</span>
                    <span className={styles.dayTempLow}>{Math.round(d.tempMin)}°</span>
                  </div>
                  <div className={styles.dayPrecip}>
                    {d.precipSum > 0 ? `🌧️ ${d.precipSum}mm` : `🌤️ ${d.precipProbMax}% rain`}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* State-by-State Monitor */}
        <h3 className={styles.sectionTitle}>
          <span>🇮🇳</span> {t.stateMonitor}
        </h3>
        <p style={{ color: '#8A99A8', fontSize: 13, marginBottom: '1.25rem' }}>
          Real-time weather threat tracking across Indian state capitals & met divisions. Click any state to query instant live telemetry.
        </p>
        <div className={styles.statesGrid}>
          {INDIAN_STATES_SUMMARY.map((st) => (
            <div
              key={st.name}
              className={styles.stateCard}
              onClick={() => {
                setSearchQuery(st.capital);
                fetchWeather(st.capital);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <div>
                <div className={styles.stateName}>{st.name}</div>
                <div className={styles.stateRegion}>
                  Capital: {st.capital} · {st.zone} India
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span
                  className={`${styles.stateThreat} ${
                    st.threat === 'CRITICAL'
                      ? styles.threatCRITICAL
                      : st.threat === 'WARNING'
                      ? styles.threatWARNING
                      : st.threat === 'WATCH'
                      ? styles.threatWATCH
                      : styles.threatNORMAL
                  }`}
                >
                  {st.threat}
                </span>
                <div style={{ fontSize: 11, color: '#8A99A8', marginTop: 4 }}>
                  {st.rain}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
