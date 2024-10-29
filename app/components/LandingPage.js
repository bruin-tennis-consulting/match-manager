import Image from 'next/image'
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
          <div className={styles.mainText}>
            <h1>BRUIN</h1>
            <h1>SPORTS</h1>
            <h1>ANALYTICS</h1>
          </div>
          <div className={styles.subText}>
            <p>Empowering Tennis Excellence </p>
            <p>through Data-Driven Insights</p>
            <button className={styles.startButton}>Start Now</button>
          </div>
          <div className={styles.imageContainer}>
            <Image
              src="/images/Landing1.png"
              alt="Image 1"
              width={400}
              height={400}
              className={styles.image1}
            />
            <Image
              src="/images/Landing2.png"
              alt="Image 2"
              width={400}
              height={400}
              className={styles.image2}
            />
            <Image
              src="/images/Landing3.png"
              alt="Image 3"
              width={400}
              height={400}
              className={styles.image3}
            />
            <Image
              src="/images/Landing4.png"
              alt="Image 4"
              width={400}
              height={400}
              className={styles.image4}
            />
          </div>
          <div className={styles.polygon}></div>
          <div className={styles.logo}>
            <Image
              src="/images/ucla.png"
              alt="UCLA Logo"
              width={80} // Set width based on design needs
              height={40} // Set height based on design needs; adjust for aspect ratio
              layout="intrinsic"
              objectFit="contain"
            />
          </div>
        </>
      ) : (
        <SignIn /> // Render the SignIn form only if showSignIn is true
      )}
    </div>
  )
}
