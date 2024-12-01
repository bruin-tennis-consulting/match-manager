'use client'

import { React, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { collection, getDocs } from 'firebase/firestore'

import { db } from '@/app/services/initializeFirebase'

import PlayerProfileHeader from '@/app/components/PlayerProfileHeader'
import { useData } from '@/app/components/DataProvider'
import DashTileContainer from '@/app/components/DashTileContainer'

import styles from '@app/styles/Profile.module.css'

const ProfilePage = () => {
  const router = useRouter()
  const { matches } = useData()
  const pathname = usePathname()
  const player = pathname.substring(pathname.lastIndexOf('/') + 1)
  const [playerData, setPlayerData] = useState()

  const formatMatches = (matches) => {
    return matches
      .filter((match) => match.version === 'v1') // Filter for version 'v1'
      .filter(
        (match) =>
          match.players.client.firstName ===
          player.split('-')[0].replace(/^./, (char) => char.toUpperCase())
      )
      .sort((a, b) => new Date(b.matchDate) - new Date(a.matchDate))
    // Sort by matchDate in descending order
  }

  const formattedMatches = formatMatches(matches)

  // Fetch Player data
  useEffect(() => {
    const fetchPlayer = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'teams'))
        const teamsData = querySnapshot.docs.map((doc) => doc.data())
        const mensTeam = teamsData.find((team) => team.name === 'UCLA (M)') // Need to set this to dependent on auth?
        const [firstName, lastName] = player.split('-')
        const targetPlayer = mensTeam.players.find(
          (player) =>
            player.firstName.toLowerCase() === firstName.toLowerCase() &&
            player.lastName.toLowerCase() === lastName.toLowerCase()
        )

        if (targetPlayer) {
          setPlayerData({
            name: `${targetPlayer.firstName} ${targetPlayer.lastName}`,
            bio: targetPlayer.bio, // Use temp bio if missing
            height: targetPlayer.height,
            class: targetPlayer.class,
            age: targetPlayer.age,
            pictureUrl: targetPlayer.largePhoto,
            overallWins: targetPlayer.stats?.overallWins,
            singleWins: targetPlayer.stats?.singleWins,
            doubleWins: targetPlayer.stats?.doubleWins
          })
        }
      } catch (error) {
        console.error('Error retrieving player details:', error)
      }
    }
    fetchPlayer()
  }, [player])

  const handleTileClick = (videoId) => {
    router.push(`/matches/${videoId}`)
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.header}>BSA | Tennis Consulting</h2>
      <div className={styles.profileContainer}>
        {playerData && playerData.name && (
          <PlayerProfileHeader playerData={playerData} />
        )}
      </div>
      <h1 className={styles.sectionHeader}>Statistics</h1>
      <h1 className={styles.sectionHeader}>Matches</h1>
      <div className={styles.matchesContainer}>
        {formattedMatches && formattedMatches.length > 0 && (
          <DashTileContainer
            matches={formattedMatches}
            matchType="Singles"
            onTileClick={handleTileClick}
            cols={4}
          />
        )}
      </div>
    </div>
  )
}

export default ProfilePage
