// app/profile/[playerId]/ClientComponent.jsx
'use client'

import { useRouter } from 'next/navigation'
import { useData } from '@/app/DataProvider'
import PlayerProfileHeader from '@/app/components/PlayerProfileHeader'
import DashTileContainer from '@/app/components/DashTileContainer'
import styles from '@/app/styles/Profile.module.css'

export default function PlayerProfile({ playerData, playerId }) {
  const router = useRouter()
  const { matches } = useData()

  const formatMatches = (matches) => {
    if (!matches) return []
    const firstName = playerId
      .split('-')[0]
      .replace(/^./, (char) => char.toUpperCase())

    return matches
      .filter(
        (match) =>
          match.version === 'v1' &&
          match.players?.client?.firstName === firstName
      )
      .sort((a, b) => new Date(b.matchDate) - new Date(a.matchDate))
  }

  const formattedMatches = formatMatches(matches)

  return (
    <div className={styles.container}>
      <div className={styles.profileContainer}>
        <PlayerProfileHeader playerData={playerData} />
      </div>
      <h1 className={styles.sectionHeader}>Statistics</h1>
      <h1 className={styles.sectionHeader}>Matches</h1>
      <div className={styles.matchesContainer}>
        {formattedMatches.length > 0 ? (
          <DashTileContainer
            matches={formattedMatches}
            matchType="Singles"
            onTileClick={(videoId) => router.push(`/matches/${videoId}`)}
            cols={4}
          />
        ) : (
          <p>Loading ... or No matches found</p>
        )}
      </div>
    </div>
  )
}
