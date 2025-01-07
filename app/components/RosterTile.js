import React, { useState } from 'react'

import styles from '@/app/styles/Roster.module.css'
const RosterTile = ({ firstName, lastName, playerPhoto }) => {
  const [playerClicked, setPlayerClicked] = useState(false)

  const handleClick = () => {
    setPlayerClicked(!playerClicked)
  }

  return (
    <div className={styles.playerContainer}>
      <div
        className={styles.infoContainer}
        style={{ backgroundColor: playerClicked ? '#F1F9FF' : '#FFFFFF' }}
        onClick={handleClick} // Handle click event
      >
        <img className={styles.playerImage} src={playerPhoto} alt="" />
        <div className={styles.textContainer}>
          <div className={styles.playerName}>
            {firstName} {lastName}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RosterTile
