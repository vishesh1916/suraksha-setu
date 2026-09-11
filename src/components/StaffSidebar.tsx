'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '@/app/staff/staff.module.css';

export function StaffSidebar({ activeTab, role = 'Officer' }: { activeTab: string; role?: string }) {
  const router = useRouter();

  const tabs = [
    { id: 'queue', label: 'Review Queue', icon: '📋', href: '/staff/queue' },
    { id: 'alerts', label: 'Alert Manager', icon: '🔔', href: '/staff/alerts' },
    { id: 'admin', label: 'Admin Console', icon: '⚙️', href: '/staff/admin' },
  ];

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarLogo}>
        <span>🛡️</span>
        <div>
          <span className={styles.sidebarTitle}>Suraksha Setu Ops</span>
          <span className={styles.sidebarRole}>{role}</span>
        </div>
      </div>

      <nav className={styles.sidebarNav}>
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={`${styles.sidebarLink} ${activeTab === tab.id ? styles.sidebarLinkActive : ''}`}
          >
            <span>{tab.icon}</span> {tab.label}
          </Link>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.sessionPill}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399' }} />
          <span>Clearance: Verified</span>
        </div>

        <Link href="/" className={styles.sidebarLink}>
          <span>🌐</span> Public Portal
        </Link>

        <button type="button" onClick={handleLogout} className={styles.logoutButton}>
          <span>🚪</span> Sign Out
        </button>
      </div>
    </aside>
  );
}
