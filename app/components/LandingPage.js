import { useState } from 'react'
import { useAuth } from '../components/AuthWrapper' // Import authentication context
import SignIn from './SignIn' // Import the SignIn component
import styles from '../styles/LandingPage.module.css'

export default function LandingPage() {
  const [showSignIn, setShowSignIn] = useState(false)
  const { authUser, handleSignOut } = useAuth() // Get authUser and handleSignOut from Auth context

  const handleSignIn = () => {
    setShowSignIn(true) // Set to show SignIn component when Sign In button is clicked
  }

  return (
    <div>
      {!showSignIn ? ( // Only show this if SignIn is not visible
        <>
          <div className={styles.titleBar}>
            <div className={styles.leftTitle}>
              <h1>BSA | Tennis Consulting</h1>
            </div>
            <div className={styles.rightTitle}>
              {authUser ? (
                <button onClick={handleSignOut}>Sign Out</button>
              ) : (
                <button onClick={handleSignIn}>Sign In</button> // Show this button to display SignIn
              )}
            </div>
          </div>
          <p>Empowering Tennis Excellence through Data-Driven Insights.</p>
        </>
      ) : (
        <SignIn /> // Render the SignIn form only if showSignIn is true
      )}
    </div>
  )
}
