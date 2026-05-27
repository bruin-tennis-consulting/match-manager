'use client'
import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import RosterList from './RosterList'
import SearchBox from '@/app/components/SearchBox'
import { useData } from '@/app/DataProvider'
import styles from '@/app/styles/Navbar.module.css'
import rosterIcon from '@/public/rosterIcon.svg'
import Image from 'next/image'

// Navbar is wrapped by Auth: show this when signed in
const NavbarMobile = () => {
  const [showRoster, setShowRoster] = useState(false)
  const { searchTerm, handleSearch, handleClearSearch } = useData()
  const pathname = usePathname()
  const router = useRouter()

  const handleSearchSubmit = (query) => {
    // Set the search term
    handleSearch(query)
    // Redirect to home if not already there
    if (pathname !== '/') {
      router.push('/')
    }
  }

  return (
    <div>
      <div className={styles.mobileContainer}>
        <header className={styles.header}>
          <div className={styles.mobileTitleBar}>
            <h1>
              <Link href="/" className={styles.mobileNoUnderline}>
                BSA | Tennis Consulting
              </Link>
            </h1>
            <button
              onClick={() => setShowRoster((prev) => !prev)}
              className={styles.iconButton}
              aria-label="Togegle roster"
            >
              <Image src={rosterIcon} alt="Roster" width={24} height={24} />
            </button>
          </div>
        </header>
        <SearchBox
          searchTerm={searchTerm}
          onSubmit={handleSearchSubmit}
          onClear={handleClearSearch}
        />
      </div>
      <div className={styles.rosterContainer}>
        {showRoster && <RosterList />}
      </div>
    </div>
  )
}

export default NavbarMobile
