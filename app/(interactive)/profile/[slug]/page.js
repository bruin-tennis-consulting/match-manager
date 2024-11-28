'use client'

import { React, useEffect, useState } from 'react'
import PlayerProfileHeader from '@/app/components/PlayerProfileHeader'
import { useRouter, usePathname } from 'next/navigation'
import { useData } from '@/app/components/DataProvider'
import styles from '../../../styles/Profile.module.css'
import DashTileContainer from '@/app/components/DashTileContainer'

import { db } from '@/app/services/initializeFirebase'
import { collection, getDocs } from 'firebase/firestore'

const playerDataTemp = {
  name: 'Govind Nanda',
  class: 'Junior',
  height: "5'10",
  age: 22,
  pictureUrl: 'https://example.com/profile.jpg',
  bio: 'Govind Nanda utilized an additional year of eligibility granted by the NCAA due to COVID-19 and had a strong tennis season. He achieved a 12-10 singles record (10-8 in dual matches) and a 19-5 doubles mark (17-4 in dual matches), leading his team in dual-match doubles wins. Nanda also contributed to his team’s success with five singles wins against nationally-ranked players and was named to the Athletic Director’s Honor Roll for Fall 2023.',
  overallWins: 50,
  singleWins: 25,
  doubleWins: 25
}

const ProfilePage = () => {
  const router = useRouter()
  const { matches } = useData()
  const pathname = usePathname()
  const player = pathname.substring(pathname.lastIndexOf('/') + 1)
  const [playerData, setPlayerData] = useState()

  const formatMatches = (matches) => {
    return (
      matches
        .filter((match) => match.version === 'v1') // Filter for version 'v1'
        /* .filter(
          (match) => match.players.client.firstName === player.split('-')[0]
        ) // Filter for player */
        .filter((match) => match.players.client.firstName === 'Rudy') // Filter for player
        .sort((a, b) => new Date(b.matchDate) - new Date(a.matchDate))
    ) // Sort by matchDate in descending order
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
          console.log('Player found:', targetPlayer)
          setPlayerData((prevData) => ({
            ...prevData,
            name: `${targetPlayer.firstName} ${targetPlayer.lastName}`,
            bio: targetPlayer.bio, // Use temp bio if missing
            height: targetPlayer.height,
            class: targetPlayer.class,
            age: targetPlayer.age,
            pictureUrl: targetPlayer.largePhoto,
            overallWins: targetPlayer.stats?.overallWins,
            singleWins: targetPlayer.stats?.singleWins,
            doubleWins: targetPlayer.stats?.doubleWins
          }))
          /* const playerInfo = {
            firstName: targetPlayer.firstName,
            lastName: targetPlayer.lastName,
            bio: targetPlayer.bio,
            height: targetPlayer.height,
            age: targetPlayer.age,
            largePhotoUrl: targetPlayer.largePhoto,
            stats: targetPlayer.stats,
            photoUrl: targetPlayer.photo
          }
          setPlayerData(playerInfo) */
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
