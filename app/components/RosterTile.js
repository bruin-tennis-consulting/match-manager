import Link from 'next/link'
import Image from 'next/image'
import styles from '@/app/styles/Roster.module.css'
import defaultPhoto from '@/public/images/defaultPhotoBig.png'

const RosterTile = ({ firstName, lastName, photo, largePlayerPhoto }) => {
  // Format name for URL - handle special characters, multiple spaces, and accents
  const cleanString = (str) => {
    return (
      str
        .toLowerCase()
        // Replace accented characters with non-accented versions
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        // Replace multiple spaces with single dash
        .replace(/\s+/g, '-')
        // Remove any non-alphanumeric characters except dashes
        .replace(/[^a-z0-9-]/g, '')
        // Remove multiple consecutive dashes
        .replace(/-+/g, '-')
        // Remove leading/trailing dashes
        .replace(/^-+|-+$/g, '')
    )
  }

  const playerId = `${cleanString(firstName)}-${cleanString(lastName)}`

  return (
    <div className={styles.playerContainer}>
      <Link href={`/profile/${playerId}`} style={{ textDecoration: 'none' }}>
        <div className={styles.infoContainer}>
          <div className={styles.imageWrapper}>
            <Image
              src={photo || defaultPhoto.src}
              alt={`Photo of ${firstName} ${lastName}`}
              width={50}
              height={50}
              className={styles.playerImage}
              onError={(e) => {
                if (e.target.src !== defaultPhoto.src) {
                  e.target.src = defaultPhoto.src
                } else {
                  e.target.style.display = 'none'
                }
              }}
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
