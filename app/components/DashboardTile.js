import React, { useEffect, useState } from 'react'
import Image from 'next/image'

import styles from '@/app/styles/DashboardTile.module.css'
import { useData } from '@/app/DataProvider'
import { getLogoFromCache, setLogoInCache } from '@/app/services/logoCache'

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
  const [isMobile, setIsMobile] = useState(false)

  const isOpaque = (player1Scores, player2Scores) => {
    return player1Scores.map((score, index) => {
      const player1Score = !isNaN(score.score) ? score.score : 0
      const player2Score = !isNaN(player2Scores[index]?.score)
        ? player2Scores[index].score
        : 0
      return player1Score > player2Score
    })
  }

  const player1Opacity = isOpaque(player1FinalScores, player2FinalScores)

  // Get match winner from Opacity Array
  const player1Wins = player1Opacity.filter(Boolean).length
  const player2Wins = player1Opacity.length - player1Wins // Total length - player1Wins
  const player1IsWinner = player1Wins > player2Wins
  const player2IsWinner = player2Wins > player1Wins

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const formatName = (name) => {
    if (!name) return ''
    const [first, last] = name.split(' ')
    return isMobile && last ? `${first} ${last[0]}.` : name
  }

  useEffect(() => {
    // Check cache first
    const cachedClientLogo = getLogoFromCache(clientTeam)
    const cachedOpponentLogo = getLogoFromCache(opponentTeam)

    if (cachedClientLogo && cachedOpponentLogo) {
      setClientLogo(cachedClientLogo)
      setOpponentLogo(cachedOpponentLogo)
      return
    }

    // If not in cache, use the logos from DataProvider
    if (logos[clientTeam]) {
      setClientLogo(logos[clientTeam])
      setLogoInCache(clientTeam, logos[clientTeam])
    }
    if (logos[opponentTeam]) {
      setOpponentLogo(logos[opponentTeam])
      setLogoInCache(opponentTeam, logos[opponentTeam])
    }
  }, [clientTeam, opponentTeam, logos])

  // Render function for scores
  const renderScore = (score, index, isPlayer1, tieScores) => {
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

  // Render name opacity
  const renderNameOpacity = (playerName, didWin) => {
    return (
      <div
        style={{
          position: 'relative',
          opacity: isUnfinished ? '40%' : didWin ? '100%' : '40%'
        }}
      >
        {playerName}
      </div>
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
            {clientLogo ? (
              <Image
                src={clientLogo || '/images/default-logo.svg'}
                alt={`${clientTeam} logo`}
                width={100}
                height={100}
                onError={(e) => {
                  if (e.target.src !== '/images/default-logo.svg') {
                    e.target.src = '/images/default-logo.svg'
                  } else {
                    e.target.style.display = 'none'
                  }
                }}
              />
            ) : (
              <p>Logo not available</p>
            )}
          </div>
          <div className={styles.playerInfoName}>
            {renderNameOpacity(formatName(player1Name), player1IsWinner)}{' '}
            {isUnfinished && '(UF)'}
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
            {opponentLogo ? (
              <Image
                src={opponentLogo || '/images/default-logo.svg'}
                alt={`${opponentTeam} logo`}
                width={100}
                height={100}
                onError={(e) => {
                  if (e.target.src !== '/images/default-logo.svg') {
                    e.target.src = '/images/default-logo.svg'
                  } else {
                    e.target.style.display = 'none'
                  }
                }}
              />
            ) : (
              <p>Logo not available</p>
            )}
          </div>
          <div className={styles.playerInfoName}>
            {renderNameOpacity(formatName(player2Name), player2IsWinner)}
          </div>
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
