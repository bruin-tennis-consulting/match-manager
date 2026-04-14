import React, { useState, useEffect } from 'react'
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
  isTagged = false,
  displaySections = { score: true, info: true, matchup: true }, // default all true
  isDashboard = false
}) => {
  const { clientLogo, opponentLogo, loading } = useTeamLogos(
    clientTeam,
    opponentTeam
  )

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const formatName = (name) => {
    if (!name) return ''
    const [first, ...rest] = name.split(' ')
    const last = rest.pop()
    return isMobile && last ? `${first} ${last[0]}.` : name
  }

  // to calculate the opacity
  const player1Opacity = isOpaque(player1FinalScores, player2FinalScores)

  // Get match winner from Opacity Array
  const player1Wins = player1Opacity.filter(Boolean).length
  const player2Wins = player1Opacity.length - player1Wins // Total length - player1Wins
  const player1IsWinner = player1Wins > player2Wins
  const player2IsWinner = player2Wins > player1Wins

  const renderNameOpacity = (playerName, utr, didWin, isUnfinishedLocal) => {
    return (
      <div
        style={{
          opacity: isUnfinishedLocal ? '40%' : didWin ? '100%' : '40%',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {playerName} {isUnfinishedLocal && '(UF)'}
        {utr && ` (${utr})`}
      </div>
    )
  }

  const actuallyTagged = isTagged || tagged?.status

  if (loading) {
    return <div>Loading logos...</div>
  }

  // Render function for scores
  const renderScore = (score, index, isPlayer1, tieScores) => {
    console.log('Rendering score:', {
      score,
      index,
      isPlayer1,
      tieScores
    })
    const lastSetIndex =
      player1FinalScores[2].score == null ? 1 : player1FinalScores.length - 1
    const isLastSet = index === lastSetIndex
    const opacity =
      isUnfinished && isLastSet
        ? '40%' // Grey out last set if unfinished
        : isPlayer1
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
                letterSpacing: '0.05em'
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
    <div
      className={`${styles.matchTilesContainer} ${isDashboard ? styles.isDashboard : ''}`}
    >
      <div className={styles.matchInfoContainer}>
        <div className={styles.matchTopLine}>
          <div className={styles.containerTitle}>Final Score</div>
          {actuallyTagged && (
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
            {renderNameOpacity(
              formatName(player1Name),
              player1UTR,
              player1IsWinner,
              isUnfinished
            )}
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
              layout="fill"
              objectFit="contain"
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
            {renderNameOpacity(
              formatName(player2Name),
              player2UTR,
              player2IsWinner,
              false
            )}
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
