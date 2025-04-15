import React, { useState, useEffect } from 'react'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import styles from '@/app/styles/SignIn.module.css'

// autoLogin triggers autoLogin with demoCredentials
const SignIn = ({ autoLogin = false, demoCredentials = null }) => {
  const [credentials, setCredentials] = useState({
    username: demoCredentials?.username || '',
    password: demoCredentials?.password || ''
  })
  const [error, setError] = useState(null)

  console.log(error)

  const handleSignIn = async (e) => {
    if (e) e.preventDefault()
    try {
      const auth = getAuth()
      const email = `${credentials.username}@ucla.edu` // Append @ucla.edu to the username
      await signInWithEmailAndPassword(auth, email, credentials.password)
      setError(null) // Clear any previous errors on successful sign-in
    } catch (error) {
      setError('The username or password is incorrect. Please try again.')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setCredentials({ ...credentials, [name]: value })
  }

  // if autoLogin is true and we have credentials, use it
  useEffect(() => {
    if (autoLogin && demoCredentials) {
      handleSignIn()
    }
  }, [autoLogin])

  return (
    <div>
      <div className={styles.container}>
        <form onSubmit={handleSignIn}>
          <div className={styles.card}>
            <img>{/* Add logo if needed */}</img>
            {error && (
              <div
                style={{
                  color: 'red',
                  marginBottom: '10px',
                  textAlign: 'center' // Center the text
                }}
              >
                {error}
              </div>
            )}
            <h2>Sign in to your account</h2>
            <div>
              <input
                type="text"
                name="username"
                value={credentials.username}
                onChange={handleChange}
                placeholder="Username"
              />
            </div>
            <div>
              <input
                type="password"
                name="password"
                value={credentials.password}
                onChange={handleChange}
                placeholder="Password"
              />
            </div>
            <button type="submit">Sign In</button>
            {/* <div style={{ color: 'grey', fontSize: '0.7rem' }}> */}
            <div className={styles.infoBox}>
              <p>
                Need Help?{' '}
                <a
                  href="mailto:uclatennisconsulting@gmail.com"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  <b>Contact Us</b>
                </a>
              </p>
              {/* add contact details */}
              <p>To demo this page, use:</p>
              <ul>Username: demo</ul>
              <ul>Password: demo123</ul>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SignIn
