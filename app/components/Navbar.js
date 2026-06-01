'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { useAuth } from '@/app/AuthWrapper'
import { useData } from '@/app/DataProvider'
import SearchBox from '@/app/components/SearchBox'
import styles from '@/app/styles/Navbar.module.css'

// Navbar is wrapped by Auth: show this when signed in
const Navbar = () => {
  const { handleSignOut } = useAuth()
  const { searchTerm, handleSearch, handleClearSearch } = useData()
  const pathname = usePathname()
  const router = useRouter()

  // Check if we're on a management-related page
  const isManagementPage =
    pathname === '/match-list' ||
    pathname.startsWith('/match-list/') ||
    pathname === '/player-management' ||
    pathname === '/match-management'

  const handleSearchSubmit = (query) => {
    // Set the search term
    handleSearch(query)
    // Redirect to home if not already there
    if (pathname !== '/') {
      router.push('/')
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleBar}>
          <h1>
            <Link href="/" className={styles.noUnderline}>
              BSA | Tennis Consulting
            </Link>
          </h1>
          <SearchBox
            searchTerm={searchTerm}
            onSubmit={handleSearchSubmit}
            onClear={handleClearSearch}
          />
          <nav className={styles.navLinks}>
            {isManagementPage && (
              <>
                <Link href="/player-management" className={styles.navLink}>
                  Player/Team Upload
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
          <div className={styles.rightNav}>
            <Link href="/recruitment-portal" className={styles.recruitingLink}>
              Recruiting Portal{' '}
              <span className={styles.navBetaBadge}>Beta</span>
            </Link>
            <div className={styles.buttonBox}>
              <button onClick={handleSignOut}>Sign Out</button>
            </div>
          </div>
        </div>
      </header>
    </div>
  )
}

export default Navbar
