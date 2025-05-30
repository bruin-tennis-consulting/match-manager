import React from 'react'
import Image from 'next/image'
import styles from '@/app/styles/MatchTiles.module.css'
import { useTeamLogos } from '@/app/hooks/useTeamLogos'

// Calculate opacity for individual scores
const isOpaque = (player1Scores, player2Scores) => {
  return player1Scores.map((score, index) => {
    const player1Score = !isNaN(score.score) ? score.score : 0
    const player2Score = !isNaN(player2Scores[index]?.score)
      ? player2Scores[index].score
      : 0
    return player1Score > player2Score
  })
}

const MatchTiles = ({
  // matchName,
  clientTeam,
  opponentTeam,
  matchDetails,
  date,
  player1Name,
  player2Name,
  player1FinalScores,
  player2FinalScores,
  player1TieScores,
  player2TieScores,
  player1UTR,
  player2UTR,
  isUnfinished,
  tagged = { status: false },
  displaySections = { score: true, info: true, matchup: true } // default all true
}) => {
  const { clientLogo, opponentLogo, loading } = useTeamLogos(
    clientTeam,
    opponentTeam
  )

  // to calculate the opacity
  const player1Opacity = isOpaque(player1FinalScores, player2FinalScores)

  if (loading) {
    return <div>Loading logos...</div>
  }

  // Render function for scores
  const renderScore = (score, index, isPlayer1, tieScores) => {
    const opacity = isPlayer1
      ? player1Opacity[index]
        ? '100%'
        : '40%'
      : !player1Opacity[index]
        ? '100%'
        : '40%'

    return (
      !isNaN(score.score) && (
        <div
          key={index}
          style={{
            position: 'relative',
            opacity
          }}
        >
          {score.score}
          {tieScores[index] && (
            <sup
              style={{
                position: 'absolute',
                fontSize: '0.6em',
                top: '-0.3em',
                left: '0.9em',
                letterSpacing: '1vw'
              }}
            >
              {tieScores[index]}
            </sup>
          )}
        </div>
      )
    )
  }

  return (
    <div className={styles.matchTilesContainer}>
      <div className={styles.matchInfoContainer}>
        <div className={styles.matchTopLine}>
          <div className={styles.containerTitle}>Final Score</div>
          {tagged.status && (
            <div className={styles.containerTagged}>Tagged</div>
          )}
        </div>
        {/* Player 1 Information  */}
        <div className={styles.playerInfo}>
          <div className={styles.playerSchoolImgcontainerhome}>
            <Image
              src={clientLogo || '/images/default-logo.svg'}
              alt={`${clientTeam} logo`}
              width={50}
              height={50}
              onError={(e) => {
                if (e.target.src !== '/images/default-logo.svg') {
                  e.target.src = '/images/default-logo.svg'
                } else {
                  e.target.style.display = 'none'
                }
              }}
            />
          </div>
          <div className={styles.playerInfoName}>
            {player1Name} {isUnfinished && '(UF)'}
            {player1UTR && `(${player1UTR})`}
          </div>
          <div className={styles.playerInfoScore}>
            {player1FinalScores.map((score, index) =>
              renderScore(score, index, true, player1TieScores)
            )}
          </div>
        </div>
        {/* Player 2 Information */}
        <div className={styles.playerInfo}>
          <div className={styles.playerSchoolImgcontainer}>
            <Image
              src={opponentLogo || '/images/default-logo.svg'}
              alt={`${opponentTeam} logo`}
              width={50}
              height={50}
              onError={(e) => {
                if (e.target.src !== '/images/default-logo.svg') {
                  e.target.src = '/images/default-logo.svg'
                } else {
                  e.target.style.display = 'none'
                }
              }}
            />
          </div>
          <div className={styles.playerInfoName}>
            {player2Name} {player2UTR && `(${player2UTR})`}
          </div>
          <div className={styles.playerInfoScore}>
            {player2FinalScores.map((score, index) =>
              renderScore(score, index, false, player2TieScores)
            )}
          </div>
        </div>
      </div>

      {/* Match Location */}
      {displaySections.info && (
        <div className={styles.matchInfoContainer}>
          <div className={styles.containerTitle}>Match Information</div>
          <div className={styles.containerInfo}>{date}</div>
          <div className={styles.containerInfo}>{matchDetails}</div>
        </div>
      )}
      {/* School Info */}
      {displaySections.matchup && (
        <div className={styles.matchInfoContainer}>
          <div className={styles.containerTitle}>Matchup</div>
          <div className={styles.containerInfo}>
            {clientTeam.replace(/\s+\([MW]\)$/, '')}
          </div>
          <div className={styles.containerInfo}>
            {opponentTeam.replace(/\s+\([MW]\)$/, '')}
          </div>
        </div>
      )}
    </div>
  )
}

export default MatchTiles
