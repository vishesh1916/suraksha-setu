'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { translations, getSavedLanguage, setSavedLanguage, SUPPORTED_LANGUAGES, type Language } from '@/lib/i18n';
import styles from './navbar.module.css';

export function Navbar() {
  const pathname = usePathname();
  const [lang, setLang] = useState<Language>('en');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLang(getSavedLanguage());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langWrapperRef.current && !langWrapperRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
    }
    if (langDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [langDropdownOpen]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setLangDropdownOpen(false);
  }, [pathname]);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleSelectLanguage = (nextLang: Language) => {
    setLang(nextLang);
    setSavedLanguage(nextLang);
    setLangDropdownOpen(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('languagechange', { detail: nextLang }));
    }
  };

  const t = translations[lang] || translations.en;

  return (
    <>
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

        {/* Desktop Navigation Links */}
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
            href="/track"
            className={`${styles.navLink} ${pathname === '/track' ? styles.navLinkActive : ''}`}
          >
            {t.nav.track}
          </Link>
          <Link
            href="/authorities"
            className={`${styles.navLink} ${pathname.startsWith('/authorities') || pathname.startsWith('/staff') ? styles.navLinkActive : ''}`}
          >
            {t.nav.authorities}
          </Link>
          <Link
            href="/about"
            className={`${styles.navLink} ${pathname === '/about' ? styles.navLinkActive : ''}`}
          >
            {t.nav.about}
          </Link>
        </nav>

        {/* Desktop Actions */}
        <div className={styles.navActions}>
          {/* 6-Language Multilingual Dropdown */}
          <div className={styles.langDropdownWrapper} ref={langWrapperRef}>
            <button
              type="button"
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className={styles.langBtn}
              title="Choose Language (6 Prominent Languages of India)"
              id="language-toggle-btn"
              aria-expanded={langDropdownOpen}
            >
              <span>🌐</span>
              <span>{SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.nativeName || 'English'}</span>
              <span style={{ fontSize: '10px', opacity: 0.7 }}>▾</span>
            </button>

            {langDropdownOpen && (
              <div className={styles.langDropdown}>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    className={`${styles.langDropdownItem} ${lang === l.code ? styles.langDropdownItemActive : ''}`}
                    onClick={() => handleSelectLanguage(l.code)}
                  >
                    <span className={styles.langNativeName}>{l.nativeName}</span>
                    <span className={styles.langEnglishName}>{l.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link href="/login" className={styles.signInLink}>
            {t.nav.signIn}
          </Link>

          <Link href="/map" className={styles.openPlatformBtn} id="open-platform-btn">
            <span>{t.nav.openPlatform}</span>
          </Link>

          {/* Accessible Mobile Hamburger Toggle */}
          <button
            type="button"
            className={styles.mobileMenuToggle}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* Accessible Mobile Navigation Overlay */}
      {mobileMenuOpen && (
        <div className={styles.mobileDrawerBackdrop} onClick={() => setMobileMenuOpen(false)}>
          <div
            className={styles.mobileDrawer}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation Menu"
          >
            <div className={styles.mobileDrawerHeader}>
              <div className={styles.mobileDrawerBrand}>
                <span style={{ fontSize: 20 }}>🛡️</span>
                <strong>{t.appName}</strong>
              </div>
              <button
                type="button"
                className={styles.mobileCloseBtn}
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            {/* Prominent Quick Actions (One-Handed Mobile Reach) */}
            <div className={styles.mobileQuickActions}>
              <Link href="/map" className={styles.mobileActionPrimary} onClick={() => setMobileMenuOpen(false)}>
                <span>🗺️ View Local Risk</span>
                <span>→</span>
              </Link>
              <Link href="/report" className={styles.mobileActionSecondary} onClick={() => setMobileMenuOpen(false)}>
                <span>🚨 Report a Hazard</span>
                <span>+</span>
              </Link>
            </div>

            {/* Navigation Link List with Large Touch Targets */}
            <nav className={styles.mobileNavList}>
              <Link
                href="/map"
                className={`${styles.mobileNavLink} ${pathname === '/map' ? styles.mobileNavLinkActive : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className={styles.mobileNavIcon}>🗺️</span>
                <span>{t.nav.map}</span>
              </Link>
              <Link
                href="/report"
                className={`${styles.mobileNavLink} ${pathname === '/report' ? styles.mobileNavLinkActive : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className={styles.mobileNavIcon}>🚨</span>
                <span>{t.nav.report}</span>
              </Link>
              <Link
                href="/alerts"
                className={`${styles.mobileNavLink} ${pathname === '/alerts' ? styles.mobileNavLinkActive : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className={styles.mobileNavIcon}>📢</span>
                <span>{t.nav.alerts}</span>
              </Link>
              <Link
                href="/weather"
                className={`${styles.mobileNavLink} ${pathname === '/weather' ? styles.mobileNavLinkActive : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className={styles.mobileNavIcon}>🌧️</span>
                <span>{t.nav.weather}</span>
              </Link>
              <Link
                href="/track"
                className={`${styles.mobileNavLink} ${pathname === '/track' ? styles.mobileNavLinkActive : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className={styles.mobileNavIcon}>🔍</span>
                <span>{t.nav.track}</span>
              </Link>
              <Link
                href="/safety"
                className={`${styles.mobileNavLink} ${pathname === '/safety' ? styles.mobileNavLinkActive : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className={styles.mobileNavIcon}>🛡️</span>
                <span>{t.nav.safety}</span>
              </Link>
              <Link
                href="/authorities"
                className={`${styles.mobileNavLink} ${pathname.startsWith('/authorities') || pathname.startsWith('/staff') ? styles.mobileNavLinkActive : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className={styles.mobileNavIcon}>🏛️</span>
                <span>{t.nav.authorities}</span>
              </Link>
              <Link
                href="/about"
                className={`${styles.mobileNavLink} ${pathname === '/about' ? styles.mobileNavLinkActive : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className={styles.mobileNavIcon}>ℹ️</span>
                <span>{t.nav.about}</span>
              </Link>
            </nav>

            {/* Mobile Footer with 6-Language Grid & Helpline */}
            <div className={styles.mobileDrawerFooter}>
              <div>
                <div className={styles.mobileLangSectionTitle}>Choose Language / भाषा चुनें</div>
                <div className={styles.mobileLangGrid}>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      className={`${styles.mobileLangGridBtn} ${lang === l.code ? styles.mobileLangGridBtnActive : ''}`}
                      onClick={() => handleSelectLanguage(l.code)}
                    >
                      <span>{l.nativeName}</span>
                      <span className={styles.langSub}>{l.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.mobileHelpline}>
                <span>National Emergency: </span>
                <a href="tel:112"><strong>112</strong></a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
