'use client'
import Link from 'next/link'

import { useAuth } from '@/app/AuthWrapper'
import styles from '@/app/styles/Navbar.module.css'

// Navbar is wrapped by Auth: show this when signed in
const Navbar = () => {
  const { handleSignOut } = useAuth()

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleBar}>
          <h1>
            <Link href="/" className={styles.noUnderline}>
              BSA | Tennis Consulting
            </Link>
          </h1>
          <div className={styles.buttonBox}>
            <button onClick={handleSignOut}>Sign Out</button>
          </div>
        </div>
      </header>
    </div>
  )
}

export default Navbar
