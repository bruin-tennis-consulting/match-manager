'use client'
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo
} from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'

import { auth } from '@/app/services/initializeFirebase'
import { getUserProfile } from '@/app/services/userInfo'
import LandingPage from '@/app/components/LandingPage'
import Loading from './components/Loading'

import styles from '@/app/styles/Navbar.module.css'
const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [authUser, setAuthUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user)
      if (user) {
        const userProfile = await getUserProfile(user.uid)
        setUserProfile(userProfile)
      } else {
        setUserProfile(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const memoizedUserProfile = useMemo(() => userProfile, [userProfile])

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

  return (
    <div style={{ width: '100%' }}>
      <AuthContext.Provider
        value={{ authUser, userProfile: memoizedUserProfile, handleSignOut }}
      >
        {authUser ? children : <LandingPage />}
      </AuthContext.Provider>
    </div>
  )
}

export const useAuth = () => useContext(AuthContext)
