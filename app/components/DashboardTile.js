import React, { useEffect, useState } from 'react'
import styles from '../styles/DashboardTile.module.css'
import { useData } from './DataProvider'

// Calculate winner of match
const calculateWinner = (player1, player2) => {
  const player1Total = player1.reduce(
    (total, current) => (!isNaN(current.score) ? total + current.score : total),
    0
  )
  const player2Total = player2.reduce(
    (total, current) => (!isNaN(current.score) ? total + current.score : total),
    0
  )
  return player1Total > player2Total
}

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

  useEffect(() => {
    setClientLogo(logos[clientTeam])
    setOpponentLogo(logos[opponentTeam])
  }, [clientTeam, opponentTeam, logos])

  return loading ? (
    <p>Loading ...</p>
  ) : (
    <div className={styles.dashTilesContainer}>
      <div className={styles.matchInfoContainer}>
        <div className={styles.containerHeader}>
          <div className={styles.containerTitle}>Final Score</div>
          {isTagged && <div className={styles.taggedBadge}>Tagged</div>}
        </div>
        <div className={styles.playerInfo}>
          <div className={styles.playerSchoolImgcontainerhome}>
            <img src={clientLogo} alt={`${clientTeam} logo`} />
          </div>
          <div
            className={styles.playerInfoName}
            style={{
              opacity:
                isUnfinished ||
                !calculateWinner(player1FinalScores, player2FinalScores)
                  ? '40%'
                  : '100%'
            }}
          >
            {player1Name} {isUnfinished && '(UF)'}
          </div>
          <div
            className={styles.playerInfoScore}
            style={{
              opacity:
                isUnfinished ||
                !calculateWinner(player1FinalScores, player2FinalScores)
                  ? '40%'
                  : '100%'
            }}
          >
            {player1FinalScores.map(
              (score, index) =>
                !isNaN(score.score) && (
                  <div key={index} style={{ position: 'relative' }}>
                    {score.score}
                    {player1TieScores[index] && (
                      <sup
                        style={{
                          position: 'absolute',
                          fontSize: '0.6em',
                          top: '-0.3em',
                          left: '0.9em',
                          letterSpacing: '1vw'
                        }}
                      >
                        {player1TieScores[index]}
                      </sup>
                    )}
                  </div>
                )
            )}
          </div>
        </div>
        <div className={styles.playerInfo}>
          <div className={styles.playerSchoolImgcontainer}>
            <img src={opponentLogo} alt={`${opponentTeam} logo`} />
          </div>
          <div
            className={styles.playerInfoName}
            style={{
              opacity: calculateWinner(player1FinalScores, player2FinalScores)
                ? '40%'
                : '100%'
            }}
          >
            {player2Name}
          </div>
          <div
            className={styles.playerInfoScore}
            style={{
              opacity: calculateWinner(player1FinalScores, player2FinalScores)
                ? '40%'
                : '100%'
            }}
          >
            {player2FinalScores.map(
              (score, index) =>
                !isNaN(score.score) && (
                  <div key={index} style={{ position: 'relative' }}>
                    {score.score}
                    {player2TieScores[index] && (
                      <sup
                        style={{
                          position: 'absolute',
                          fontSize: '0.6em',
                          top: '-0.3em',
                          left: '0.9em',
                          letterSpacing: '1vw'
                        }}
                      >
                        {player2TieScores[index]}
                      </sup>
                    )}
                  </div>
                )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardTile
