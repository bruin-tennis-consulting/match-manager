'use client'
import Link from 'next/link'
import { useState } from 'react'
import RosterList from './RosterList'
import styles from '@/app/styles/Navbar.module.css'
import rosterIcon from '@/public/rosterIcon.svg'
import Image from 'next/image'

// Navbar is wrapped by Auth: show this when signed in
const NavbarMobile = () => {
  const [showRoster, setShowRoster] = useState(false)
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
      </div>
      <div>{showRoster && <RosterList />}</div>
    </div>
  )
}

export default NavbarMobile
