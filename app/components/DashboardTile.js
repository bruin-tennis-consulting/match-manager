import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import styles from '@/app/styles/DashboardTile.module.css'
import { useData } from '@/app/DataProvider'

const DashboardTile = ({
  clientTeam,
  opponentTeam,
  player1Name,
  player2Name,
  player1FinalScores,
  player2FinalScores,
  player1TieScores,
  player2TieScores,
  isUnfinished,
  isTagged
}) => {
  const { logos, loading } = useData()
  const [clientLogo, setClientLogo] = useState(null)
  const [opponentLogo, setOpponentLogo] = useState(null)

  const isOpaque = (player1Scores, player2Scores) => {
    return player1Scores.map((score, index) => {
      const player1Score = !isNaN(score.score) ? score.score : 0
      const player2Score = !isNaN(player2Scores[index]?.score)
        ? player2Scores[index].score
        : 0
      return player1Score > player2Score
    })
  }

  // Calculate opacity map before rendering
  const player1Opacity = isOpaque(player1FinalScores, player2FinalScores)

  useEffect(() => {
    setClientLogo(logos[clientTeam])
    setOpponentLogo(logos[opponentTeam])
  }, [clientTeam, opponentTeam, logos])

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

  return loading ? (
    <p>Loading ...</p>
  ) : (
    <div className={styles.dashTilesContainer}>
      <div className={styles.matchInfoContainer}>
        <div className={styles.containerHeader}>
          <div className={styles.containerTitle}>Final Score</div>
          {isTagged && <div className={styles.taggedBadge}>Tagged</div>}
        </div>

        {/* Player 1 */}
        <div className={styles.playerInfo}>
          <div className={styles.playerSchoolImgcontainerhome}>
            {clientLogo && (
              <Image
                src={clientLogo}
                alt={`${clientTeam} logo`}
                width={50}
                height={50}
                priority
              />
            )}
          </div>
          <div className={styles.playerInfoName}>
            {player1Name} {isUnfinished && '(UF)'}
          </div>
          <div className={styles.playerInfoScore}>
            {player1FinalScores.map((score, index) =>
              renderScore(score, index, true, player1TieScores)
            )}
          </div>
        </div>

        {/* Player 2 */}
        <div className={styles.playerInfo}>
          <div className={styles.playerSchoolImgcontainer}>
            {opponentLogo && (
              <Image
                src={opponentLogo}
                alt={`${opponentTeam} logo`}
                width={50}
                height={50}
                priority
              />
            )}
          </div>
          <div className={styles.playerInfoName}>{player2Name}</div>
          <div className={styles.playerInfoScore}>
            {player2FinalScores.map((score, index) =>
              renderScore(score, index, false, player2TieScores)
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardTile
