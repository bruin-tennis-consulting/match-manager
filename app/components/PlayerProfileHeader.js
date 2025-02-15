import React from 'react'
import styles from '@/app/styles/PlayerProfileHeader.module.css'
import defaultPhotoBig from '@/public/images/defaultPhotoBig.png'
import StatBox from '@/app/components/StatBox'
import Image from 'next/image'

const PlayerProfileHeader = ({ playerData }) => {
  return (
    <div className={styles.profileHeader}>
      {/* Player Basic Information */}
      <div className={styles.profileInfo}>
        <div className={styles.profileTop}>
          <h1 className={styles.playerName}>{playerData.name.toUpperCase()}</h1>
          <p className={styles.playerDetails}>
            Class: {playerData.class} &nbsp;|&nbsp; Height: {playerData.height}
            &nbsp;|&nbsp; Age: {playerData.age}
          </p>

          {/* Player Bio */}
          <div className={styles.playerBio}>
            <p>{playerData.bio}</p>
          </div>
        </div>
        <div className={styles.profileStats}>
          {/* Win Counters */}
          <div className={styles.filterContainer}>
            <p className={styles.filterText}>Filter</p>
            <Image
              src="/StatFilter.svg"
              alt="Statistics filter icon"
              className={styles.StatFilter}
              width={24}
              height={24}
            />
          </div>
          <div className={styles.statBoxes}>
            <StatBox
              stat="Overall Wins"
              statNum={playerData.overallWins || 50}
            />
            <StatBox stat="Single Wins" statNum={playerData.singleWins || 25} />
            <StatBox stat="Double Wins" statNum={playerData.doubleWins || 25} />
          </div>
        </div>
      </div>

      <div className={styles.profilePictureContainer}>
        <Image
          src={playerData.largePlayerPhoto || defaultPhotoBig.src}
          alt={`${playerData.name}'s profile photo`}
          className={styles.profilePicture}
          width={200} // Adjust dimensions as needed
          height={200}
          layout="intrinsic"
        />
      </div>
    </div>
  )
}

export default PlayerProfileHeader
