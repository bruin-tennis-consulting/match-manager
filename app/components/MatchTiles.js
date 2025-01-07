import React, { useEffect, useState } from 'react'

import styles from '@/app/styles/MatchTiles.module.css'
import getTeams from '@/app/services/getTeams.js'

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
  isUnfinished,
  tagged = { status: false },
  displaySections = { score: true, info: true, matchup: true } // default all true
}) => {
  const [clientLogo, setClientLogo] = useState('')
  const [opponentLogo, setOpponentLogo] = useState('')

  useEffect(() => {
    const fetchLogos = async () => {
      try {
        const allTeams = await getTeams()
        const clientLogoURL = allTeams.find(
          (team) => team.name === clientTeam
        ).logoUrl
        const opponentLogoURL = allTeams.find(
          (team) => team.name === opponentTeam
        ).logoUrl
        setClientLogo(clientLogoURL)
        setOpponentLogo(opponentLogoURL)
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    fetchLogos()
  }, [clientTeam, opponentTeam])

  return (
    <div className={styles.matchTilesContainer}>
      <div className={styles.matchInfoContainer}>
        <div className={styles.matchTopLine}>
          <div className={styles.containerTitle}>Final Score</div>
          {tagged.status && (
            <div className={styles.containerTagged}>Tagged</div>
          )}
        </div>
        {/* Player Information  */}
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
      {/* Match Location */}
      {displaySections.info && (
        <div className={styles.matchInfoContainer}>
          <div className={styles.containerTitle}>Match Information</div>
          <div className={styles.containerInfo}>{matchDetails}</div>
          <div className={styles.containerInfo}>{date}</div>
        </div>
      )}
      {/* School Info */}
      {displaySections.matchup && (
        <div className={styles.matchInfoContainer}>
          <div className={styles.containerTitle}>Matchup</div>
          <div className={styles.containerInfo}>{clientTeam}</div>
          <div className={styles.containerInfo}>{opponentTeam}</div>
        </div>
      )}
    </div>
  )
}

export default MatchTiles
