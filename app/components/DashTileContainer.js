import React from 'react'
import DashboardTile from '@/app/components/DashboardTile'
import styles from '@/app/styles/Dashboard.module.css'

const DashTileContainer = ({ matches, matchType, onTileClick, cols = 3 }) => {
  const columnClass = `matchTileContainer--${cols}`
  return (
    <>
      {matches.length > 0 && (
        <>
          <div className={styles.matchTypeHeader}>
            <h4>{matchType}</h4>
          </div>
          <div
            className={`${styles.matchTileContainer} ${styles[columnClass]}`}
          >
            {matches.map((match, idx) => (
              <div
                key={idx}
                className={styles.tileWrapper}
                onClick={() => onTileClick(match.videoID || match.id)}
              >
                <DashboardTile
                  matchName={`${match.opponent} ${match.date}`}
                  clientTeam={match.teams.clientTeam}
                  opponentTeam={match.teams.opponentTeam}
                  player1Name={`${match.players.client.firstName} ${match.players.client.lastName}`}
                  player2Name={`${match.players.opponent.firstName} ${match.players.opponent.lastName}`}
                  player1FinalScores={match.sets.map((set) => ({
                    score: set ? set.clientGames : null
                  }))}
                  player2FinalScores={match.sets.map((set) => ({
                    score: set ? set.opponentGames : null
                  }))}
                  player1TieScores={match.sets.map((set) =>
                    set ? set.clientTiebreak : null
                  )}
                  player2TieScores={match.sets.map((set) =>
                    set ? set.opponentTiebreak : null
                  )}
                  isUnfinished={false}
                  isTagged={match.published}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

export default DashTileContainer
