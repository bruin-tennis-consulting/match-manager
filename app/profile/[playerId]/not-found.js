import Link from 'next/link'
import styles from '@/app/styles/NotFound.module.css'

export default function NotFound() {
  return (
    <div className={styles.container}>
      <h2>Player Not Found</h2>
      <p>Could not find the requested player profile.</p>
      <Link href="/" className={styles.link}>
        Return to Dashboard
      </Link>
    </div>
  )
}
