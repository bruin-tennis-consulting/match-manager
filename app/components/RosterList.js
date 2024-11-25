import React, { useEffect, useState } from 'react'
import RosterTile from './RosterTile'
import { db } from '../services/initializeFirebase.js' // Ensure storage is exported from initializeFirebase.js
import { collection, getDocs } from 'firebase/firestore'

const RosterList = () => {
  // create roster list then loop through
  const [mensRoster, setMensRoster] = useState([]) // State to hold the fetched teams

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'teams'))
        const teamsData = querySnapshot.docs.map((doc) => doc.data())
        const mensTeam = teamsData.find((team) => team.name === 'UCLA (M)')
        const playersArray = mensTeam.players.map((player) => ({
          firstName: player.firstName,
          lastName: player.lastName,
          photoUrl: player.photo
        }))
        setMensRoster(playersArray)
      } catch (error) {
        console.error('Error retrieving teams:', error)
      }
    }

    fetchTeams()
  }, [])

  return (
    // entire container
    <div>
      <h1>Roster</h1>
      <div>
        {/* Loop through roster  */}
        {mensRoster.map((player, index) => (
          <RosterTile
            key={index}
            firstName={player.firstName}
            lastName={player.lastName}
            playerPhoto={player.photoUrl}
          />
        ))}
      </div>
    </div>
  )
}

export default RosterList
