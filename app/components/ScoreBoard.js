import React, { useState, useEffect } from 'react';
import styles from '../styles/Scoreboard.module.css';

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
  } = playData || {};

  const [localPlayData, setLocalPlayData] = useState(playData);

  useEffect(() => {
    if (playData) {
      const timeout = setTimeout(() => {
        setLocalPlayData(playData);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [playData]);

  // Get the server name safely
  const currentServerName = localPlayData?.serverName || serverName;

  return (
    <div className={styles.scoreboard}>
      <table>
        <thead>
          <tr>
            <th className={styles.live}>
              Live Score {isUnfinished && '(UF)'}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={styles.highlight}>{player1Name}</td>
            {player1FinalScores.map((score, index) =>
              localPlayData && !isNaN(score.score) && index + 1 < localPlayData.setNum ? (
                <td 
                  key={index} 
                  style={{ 
                    position: 'relative', 
                    opacity: score.score > player2FinalScores[index].score ? 1 : 0.4
                  }}
                >
                  {player1TieScores[index] ? (
                    <div key={index}>
                      {score.score}
                      <sup
                        style={{
                          position: 'absolute',
                          fontSize: '0.6em',
                          top: '0.1em',
                          right: '0em',
                          letterSpacing: '1px',
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
            
            <td style={{ opacity: 0.4 }}>{player1GameScore}</td>

            <td className={styles.pointScore}>
              {pointScore ? player1PointScore : player1TiebreakScore}
              {currentServerName && player1Name === currentServerName && <span> &bull;</span>}
            </td>
          </tr>
          <tr>
            <td className={styles.highlight}>{player2Name}</td>
            {player2FinalScores.map((score, index) =>
              localPlayData && !isNaN(score.score) && index + 1 < localPlayData.setNum ? (
                <td 
                  key={index} 
                  style={{ 
                    position: 'relative', 
                    opacity: score.score > player1FinalScores[index].score ? 1 : 0.4
                  }}
                >
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
            <td style={{ opacity: 0.4 }}>{player2GameScore}</td>

            <td className={styles.pointScore}>
              {pointScore ? player2PointScore : player2TiebreakScore}
              {currentServerName && player2Name === currentServerName && <span> &bull;</span>}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ScoreBoard;