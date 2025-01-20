import Link from 'next/link'
import styles from '@/app/styles/Roster.module.css'

const RosterTile = ({ firstName, lastName, playerPhoto }) => {
  const playerId = `${firstName.toLowerCase()}-${lastName.toLowerCase()}`

  return (
    <div className={styles.playerContainer}>
      <Link href={`/profile/${playerId}`} style={{ textDecoration: 'none' }}>
        <div className={styles.infoContainer}>
          <img className={styles.playerImage} src={playerPhoto} alt="" />
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
