'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './login.module.css';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/staff/queue';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid credentials. Access restricted to authorized personnel.');
        setLoading(false);
        return;
      }

      // Successful login
      router.push(redirectPath);
      router.refresh();
    } catch {
      setError('Connection to authentication gateway failed. Please retry.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginCard}>
      <div className={styles.cardBadge}>
        <span>🔒</span> Restricted Authority Portal
      </div>

      <h1 className={styles.title}>Official Access</h1>
      <p className={styles.subtitle}>
        Authorized meteorologists, disaster response officers, and system administrators.
      </p>

      {error && (
        <div className={styles.errorAlert} role="alert">
          <span>⚠️</span>
          <div>{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="username" className={styles.label}>
            Operator Username
          </label>
          <div className={styles.inputWrapper}>
            <input
              id="username"
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={styles.input}
              placeholder="Enter authorized identifier"
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="password" className={styles.label}>
            Security Password
          </label>
          <div className={styles.inputWrapper}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="Enter secure clearance passphrase"
            />
            <button
              type="button"
              className={styles.toggleBtn}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading} id="login-submit-btn">
          {loading ? (
            <>
              <span className="spinner spinner-sm" />
              <span>Verifying Clearance…</span>
            </>
          ) : (
            <>
              <span>Authenticate & Enter</span>
              <span>→</span>
            </>
          )}
        </button>

        <div style={{ marginTop: '12px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setUsername('admin');
              setPassword('Suraksha@Setu2026!');
            }}
            style={{
              background: '#FAF7F2',
              border: '1px dashed var(--color-border, #E5E2D9)',
              color: 'var(--color-charcoal, #161816)',
              fontSize: '12px',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontWeight: 600,
            }}
          >
            <span>⚡</span>
            <span>Auto-fill Duty Credentials (admin / Suraksha@Setu2026!)</span>
          </button>
        </div>
      </form>

      <div className={styles.cardFooter}>
        All authentication attempts are logged for audit compliance under the Disaster Management Framework.
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <div className={styles.bgGradients} />
      <div className={styles.gridPattern} />

      {/* Standardized Institutional Navbar */}
      <header className={styles.navbar}>
        <div className={styles.brandGroup}>
          <Link href="/" className={styles.wordmark}>
            <span className={styles.brandIcon}>🛡️</span>
            <span>SURAKSHA SETU</span>
          </Link>
          <span className={styles.subBrand}>
            सुरक्षा सेतु · National Hyperlocal Disaster Intelligence
          </span>
        </div>

        <Link href="/" className={styles.navAction}>
          <span>←</span> Back to Public Portal
        </Link>
      </header>

      {/* Main Form */}
      <main className={styles.mainContent}>
        <Suspense fallback={<div className="spinner spinner-lg" />}>
          <LoginForm />
        </Suspense>
      </main>

      {/* Institutional Footer */}
      <footer className={styles.footer}>
        <span>Ministry of Earth Sciences · NDMA · IMD Integrated Feeds</span>
        <span>Operational Readiness Tier-1 · Audit Trail Active</span>
      </footer>
    </div>
  );
}
