import Link from 'next/link'
import Image from 'next/image'
// import styles from '@/app/styles/Roster.module.css' // no longer using imported css due to issues

// Using inline styles instead of CSS modules to avoid HMR issues
const RosterTile = ({ firstName, lastName, playerPhoto }) => {
  // removes spaces from names so we can use them in the URL
  const cleanString = (str) => str.toLowerCase().replace(/\s+/g, '')
  const playerId = `${cleanString(firstName)}-${cleanString(lastName)}`

  // Define styles inline to avoid CSS module issues
  const styles = {
    playerContainer: {
      borderBottom: '0.5px solid #dedede',
      paddingTop: '2%',
      paddingBottom: '2%'
    },
    infoContainer: {
      display: 'flex',
      flexDirection: 'row',
      cursor: 'pointer',
      alignItems: 'center'
    },
    imageWrapper: {
      position: 'relative',
      width: '50px',
      height: '50px',
      flexShrink: 0,
      marginRight: '10px',
      overflow: 'hidden'
    },
    textContainer: {
      fontWeight: '550',
      flexDirection: 'column',
      justifyContent: 'center',
      display: 'flex',
      paddingLeft: '3%',
      letterSpacing: '0.5px'
    },
    playerName: {
      fontSize: '14px'
    }
  }

  return (
    <div style={styles.playerContainer}>
      <Link href={`/profile/${playerId}`} style={{ textDecoration: 'none' }}>
        <div style={styles.infoContainer}>
          <div style={styles.imageWrapper}>
            <Image
              src={playerPhoto}
              alt={`Photo of ${firstName} ${lastName}`}
              width={30}
              height={30}
              style={{
                objectFit: 'cover',
                objectPosition: 'center top',
                width: '50px',
                height: '50px',
                borderRadius: '30%'
              }}
            />
          </div>

          <div style={styles.textContainer}>
            <div style={styles.playerName}>
              {firstName} {lastName}
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}

export default RosterTile
