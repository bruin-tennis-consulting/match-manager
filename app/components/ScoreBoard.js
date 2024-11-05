import React from 'react'
import styles from '../styles/Scoreboard.module.css'

const ScoreBoard = ({
  playData,
  player1Name,
  player2Name,
  player1FinalScores,
  player2FinalScores,
  player1TieScores,
  player2TieScores,
  isUnfinished
}) => {
  const {
    player1GameScore = 0,
    player2GameScore = 0,
    player1PointScore = 0,
    player2PointScore = 0,
    player1TiebreakScore = 0,
    player2TiebreakScore = 0,
    serverName = '',
    pointScore = true
  } = playData || {}

  // console.log(playData)

  return (
    <div className={styles.scoreboard}>
      <table>
        <thead>
          <tr>
            <th className={styles.live}>Live Score {isUnfinished && '(UF)'}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={styles.highlight}>{player1Name}</td>
            {/* FINISHED SETS using data from parent! */}
            {/* Check if tie break, if so add exponent */}
            {player1FinalScores.map((score, index) =>
              playData && !isNaN(score.score) && index + 1 < playData.setNum ? (
                <td key={index} style={{ position: 'relative' }}>
                  {player1TieScores[index] ? (
                    <div key={index}>
                      {score.score}
                      <sup
                        style={{
                          position: 'absolute', 
                          fontSize: '0.6em',
                          top: '0.1em',
                          right: '0em',
                          letterSpacing: '1px'
                        }}
                      >
                        {player1TieScores[index]}
                      </sup>
                    </div>
                  ) : (
                    <span key={index}>{score.score}</span>
                  )}
                </td>
              ) : null
            )}
            {/* Current Set */}
            <td>{player1GameScore}</td>
            <td className={styles.pointScore}>
              {pointScore ? player1PointScore : player1TiebreakScore}
              {player1Name === serverName && <span> &bull;</span>}
            </td>
          </tr>
          <tr>
            <td className={styles.highlight}>{player2Name}</td>
            {/* FINISHED SETS using data from parent! */}
            {player2FinalScores.map((score, index) =>
              playData && !isNaN(score.score) && index + 1 < playData.setNum ? (
                <td key={index} style={{ position: 'relative' }}>
                  {player2TieScores[index] ? (
                    <div key={index}>
                      {score.score}
                      <sup
                        style={{
                          position: 'absolute',
                          fontSize: '0.6em',
                          top: '0.1em',
                          right: '0em',
                          letterSpacing: '1px'
                        }}
                      >
                        {player2TieScores[index]}
                      </sup>
                    </div>
                  ) : (
                    <span key={index}>{score.score}</span>
                  )}
                </td>
              ) : null
            )}
            {/* Current Set */}
            <td>{player2GameScore}</td>
            <td className={styles.pointScore}>
              {pointScore ? player2PointScore : player2TiebreakScore}
              {player2Name === serverName && <span> &bull;</span>}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default ScoreBoard
