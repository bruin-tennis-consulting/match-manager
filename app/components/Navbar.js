'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { useAuth } from '@/app/AuthWrapper'
import styles from '@/app/styles/Navbar.module.css'

// Navbar is wrapped by Auth: show this when signed in
const Navbar = () => {
  const { handleSignOut } = useAuth()
  const pathname = usePathname()

  // Check if we're on a management-related page
  const isManagementPage =
    pathname === '/match-list' ||
    pathname.startsWith('/match-list/') ||
    pathname === '/player-management' ||
    pathname === '/match-management'

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleBar}>
          <h1>
            <Link href="/" className={styles.noUnderline}>
              BSA | Tennis Consulting
            </Link>
          </h1>
          <nav className={styles.navLinks}>
            {isManagementPage && (
              <>
                <Link href="/player-management" className={styles.navLink}>
                  Player Management
                </Link>
                <Link href="/match-management" className={styles.navLink}>
                  Match Management
                </Link>
                <Link href="/match-list" className={styles.navLink}>
                  Matches & Teams
                </Link>
              </>
            )}
          </nav>
          <div className={styles.buttonBox}>
            <button onClick={handleSignOut}>Sign Out</button>
          </div>
        </div>
      </header>
    </div>
  )
}

export default Navbar
