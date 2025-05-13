import Link from 'next/link'
import Image from 'next/image'
import styles from '@/app/styles/Roster.module.css'

const RosterTile = ({ firstName, lastName, playerPhoto }) => {
  // removes spaces from names so we can use them in the URL
  const cleanString = (str) => str.toLowerCase().replace(/\s+/g, '')
  const playerId = `${cleanString(firstName)}-${cleanString(lastName)}`

  return (
    <div className={styles.playerContainer}>
      <Link href={`/profile/${playerId}`} style={{ textDecoration: 'none' }}>
        <div className={styles.infoContainer}>
          <div className={styles.imageWrapper}>
            <Image
              src={playerPhoto}
              alt={`Photo of ${firstName} ${lastName}`}
              width={50}
              height={50}
              className={styles.playerImage}
            />
          </div>

          <div className={styles.textContainer}>
            <div className={styles.playerName}>
              {firstName} {lastName}
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}

export default RosterTile
