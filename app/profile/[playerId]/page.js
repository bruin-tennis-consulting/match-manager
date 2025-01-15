// app/profile/[playerId]/page.js
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/app/services/initializeFirebase'
import { notFound } from 'next/navigation'
import PlayerProfile from '@/app/components/PlayerProfile'

// Consider moving this to a separate utils/service file
async function getPlayerData(playerId) {
  try {
    const querySnapshot = await getDocs(collection(db, 'teams'))
    const teamsData = querySnapshot.docs.map((doc) => doc.data())
    const mensTeam = teamsData.find((team) => team.name === 'UCLA (M)')
    const [firstName, lastName] = playerId.split('-')
    const targetPlayer = mensTeam?.players?.find(
      (player) =>
        player.firstName.toLowerCase() === firstName.toLowerCase() &&
        player.lastName.toLowerCase() === lastName.toLowerCase()
    )

    if (!targetPlayer) {
      return null
    }

    return {
      name: `${targetPlayer.firstName} ${targetPlayer.lastName}`,
      bio: targetPlayer.bio || 'No bio available', // Default value
      height: targetPlayer.height,
      class: targetPlayer.class,
      age: targetPlayer.age,
      pictureUrl: targetPlayer.largePhoto, // Add default image
      overallWins: targetPlayer.stats?.overallWins || 0,
      singleWins: targetPlayer.stats?.singleWins || 0,
      doubleWins: targetPlayer.stats?.doubleWins || 0
    }
  } catch (error) {
    console.error('Error retrieving player details:', error)
    throw new Error('Failed to fetch player data')
  }
}

export default async function PlayerProfilePage({ params }) {
  const playerData = await getPlayerData(params.playerId)
  if (!playerData) {
    notFound() // This will show the not-found.js page
  }

  return <PlayerProfile playerData={playerData} playerId={params.playerId} />
}
