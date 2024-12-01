'use client'
import React from 'react'
// import Link from 'next/link'

import { useAuth } from '@/app/AuthWrapper'

import styles from '@/app/styles/Navbar.module.css'

const Navbar = () => {
  const { handleSignOut } = useAuth()

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleBar}>
          <h1>BSA | Tennis Consulting</h1>
          <div className={styles.buttonBox}>
            <button onClick={handleSignOut}>Sign Out</button>
          </div>
        </div>
      </header>
    </div>
  )
}

export default Navbar
