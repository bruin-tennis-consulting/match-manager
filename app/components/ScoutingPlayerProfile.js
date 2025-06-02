'use client'
import styles from '@/app/styles/Scouting.module.css'

export default function ScoutingPlayerProfile({ playerData }) {
  const {
    firstName,
    lastName,
    age,
    height,
    class: classYear,
    position,
    plays,
    backhand,
    bio,
    photo,
    recentMatches
  } = playerData

  const photoUrl = photo || '/images/defaultPhotoBig.png'

  return (
    <div className={styles.playerProfileContainer}>
      <div className={styles.profileSection}>
        <div className={styles.playerInfo}>
          <h2>{firstName}</h2>
          <h1>{lastName}</h1>
          <p className={styles.meta}>
            AGE {age} | HEIGHT {height} | CLASS {classYear.toUpperCase()}
          </p>
        </div>
        <div className={styles.playerImage}>
          <img src={photoUrl} alt={`${firstName} ${lastName}`} />
        </div>

        <div className={styles.playerStats}>
          <div className={styles.statRow}>
            <span className={styles.label}>POSITION</span>
            <span className={styles.value}>{position}</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.label}>PLAYS</span>
            <span className={styles.value}>{plays}</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.label}>BACKHAND</span>
            <span className={styles.value}>{backhand}</span>
          </div>
          <p className={styles.bio}>{bio}</p>
        </div>
      </div>

      <div className={styles.recentMatches}>
        <h2>Recent Matches</h2>
        {recentMatches.map((match, index) => (
          <div key={index} className={styles.matchCard}>
            <div className={styles.matchMeta}>
              <div className={styles.matchInfo}>
                <div className={styles.value}>{match.eventName}</div>
                <div className={styles.label}>{match.date}</div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px'
                }}
              >
                <div className={styles.statItem}>
                  <div className={styles.value}>{match.serviceGamesHeld}</div>
                  <div className={styles.label}>Service Games Held</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.value}>{match.aces}</div>
                  <div className={styles.label}>Aces</div>
                </div>
              </div>
            </div>

            <div className={styles.scoreSection}>
              <div className={styles.scoreHeader}>
                <span>Final Score</span>
                <span>0:00</span>
              </div>
              {match.players.map((player, i) => (
                <div key={i} className={styles.scoreRow}>
                  <span
                    className={`${styles.playerName} ${i === 0 ? styles.highlighted : styles.dimmed}`}
                  >
                    {player}
                  </span>
                  <span className={styles.score}>
                    {match.finalScore[i].join('  ')}
                  </span>
                </div>
              ))}
              <a
                href={match.videoUrl}
                className={styles.videoButton}
                target="_blank"
                rel="noopener noreferrer"
              >
                Video
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
