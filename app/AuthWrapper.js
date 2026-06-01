'use client'

import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '@/app/services/initializeFirebase'
import { getUserProfile } from '@/app/services/userInfo'
import { upsertCoach } from '@/app/services/coaches'
import LandingPage from '@/app/components/LandingPage'
import Loading from './components/Loading'
import styles from '@/app/styles/Navbar.module.css'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [authUser, setAuthUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [coachRecord, setCoachRecord] = useState(null) // new state for coach record
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user)
      if (user) {
        const [userProfile, coachRecord] = await Promise.all([
          getUserProfile(user.uid),
          upsertCoach(user) // runs in parallel with getUserProfile
        ])
        setUserProfile(userProfile)
        setCoachRecord(coachRecord) // add useState for this
      } else {
        setUserProfile(null)
        setCoachRecord(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const memoizedUserProfile = useMemo(() => userProfile, [userProfile])

  const handleSignOut = () => {
    signOut(auth)
      .then(() => {
        setAuthUser(null)
        setUserProfile(null)
      })
      .catch((error) => {
        console.error('Error signing out:', error)
      })
  }

  if (loading) {
    return (
      <div>
        <div className={styles.container} style={{ marginBottom: '100px' }}>
          <header className={styles.header}>
            <div className={styles.titleBar}>
              <h1 className={styles.noUnderline}>BSA | Tennis Consulting</h1>
            </div>
            <Loading prompt={'Logging In...'} />
          </header>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%' }}>
      <AuthContext.Provider
        value={{
          authUser,
          userProfile: memoizedUserProfile,
          handleSignOut,
          coachRecord
        }}
      >
        {authUser ? children : <LandingPage />}
      </AuthContext.Provider>
    </div>
  )
}

export const useAuth = () => useContext(AuthContext)
