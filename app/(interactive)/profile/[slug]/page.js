import PlayerProfileHeader from '@/app/components/PlayerProfileHeader'
import React from 'react'
import styles from '../../../styles/Profile.module.css'
import DashTileContainer from '@/app/components/DashTileContainer'

const playerData = {
  name: 'Govind Nanda',
  class: 'Senior',
  height: "5'10",
  age: 22,
  pictureUrl: 'https://example.com/profile.jpg',
  bio: 'Govind Nanda utilized an additional year of eligibility granted by the NCAA due to COVID-19 and had a strong tennis season. He achieved a 12-10 singles record (10-8 in dual matches) and a 19-5 doubles mark (17-4 in dual matches), leading his team in dual-match doubles wins. Nanda also contributed to his team’s success with five singles wins against nationally-ranked players and was named to the Athletic Director’s Honor Roll for Fall 2023.',
  overallWins: 50,
  singleWins: 25,
  doubleWins: 25
}

const profilePage = () => {
  return (
    <div className={styles.container}>
      <h2 className={styles.header}>BSA | Tennis Consulting</h2>
      <div className={styles.profileContainer}>
        <PlayerProfileHeader playerData={playerData} />
      </div>
      <h1>Matches</h1>
      <div className={styles.matchGroup}>
        <h3>Singles</h3>
      </div>
      <DashTileContainer
        matches={singlesMatches}
        matchType="Singles"
        onTileClick={handleTileClick}
      />
    </div>
  )
}

export default profilePage
