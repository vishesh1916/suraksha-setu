'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { translations, getSavedLanguage, setSavedLanguage, type Language } from '@/lib/i18n';
import styles from './navbar.module.css';

export function Navbar() {
  const pathname = usePathname();
  const [lang, setLang] = useState<Language>('en');

  useEffect(() => {
    setLang(getSavedLanguage());
  }, []);

  const toggleLanguage = () => {
    const nextLang: Language = lang === 'en' ? 'hi' : 'en';
    setLang(nextLang);
    setSavedLanguage(nextLang);
    // Dispatch custom event so listening components update without full reload
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('languagechange', { detail: nextLang }));
    }
  };

  const t = translations[lang];

  return (
    <header className={styles.navbar}>
      <div className={styles.brandGroup}>
        <Link href="/" className={styles.wordmark} id="brand-wordmark">
          <span className={styles.brandIcon}>🛡️</span>
          <span>{t.appName}</span>
        </Link>
        <span className={styles.subBrand}>
          {lang === 'en' ? 'सुरक्षा सेतु · ' : ''}
          {t.subTitle}
        </span>
      </div>

      <nav className={styles.navLinks}>
        <Link
          href="/map"
          className={`${styles.navLink} ${pathname === '/map' ? styles.navLinkActive : ''}`}
        >
          {t.nav.map}
        </Link>
        <Link
          href="/report"
          className={`${styles.navLink} ${pathname === '/report' ? styles.navLinkActive : ''}`}
        >
          {t.nav.report}
        </Link>
        <Link
          href="/alerts"
          className={`${styles.navLink} ${pathname === '/alerts' ? styles.navLinkActive : ''}`}
        >
          {t.nav.alerts}
        </Link>
        <Link
          href="/weather"
          className={`${styles.navLink} ${pathname === '/weather' ? styles.navLinkActive : ''}`}
        >
          {t.nav.weather}
        </Link>
        <Link
          href="/track"
          className={`${styles.navLink} ${pathname === '/track' ? styles.navLinkActive : ''}`}
        >
          {t.nav.track}
        </Link>
        <Link
          href="/safety"
          className={`${styles.navLink} ${pathname === '/safety' ? styles.navLinkActive : ''}`}
        >
          {t.nav.safety}
        </Link>
        <Link
          href="/login"
          className={`${styles.navLink} ${pathname.startsWith('/staff') ? styles.navLinkActive : ''}`}
        >
          {t.nav.authorities}
        </Link>
      </nav>

      <div className={styles.navActions}>
        {/* Language Switcher */}
        <button
          type="button"
          onClick={toggleLanguage}
          className={styles.langBtn}
          title="Switch language (English / हिन्दी)"
          id="language-toggle-btn"
        >
          <span>🌐</span>
          <span>{lang === 'en' ? 'हिन्दी' : 'English'}</span>
        </button>

        <Link href="/login" className={styles.signInLink}>
          {t.nav.signIn}
        </Link>

        <Link href="/map" className={styles.openPlatformBtn} id="open-platform-btn">
          <span>{t.nav.openPlatform}</span>
        </Link>
      </div>
    </header>
  );
}
