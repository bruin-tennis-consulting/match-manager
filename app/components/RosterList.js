import React, { useEffect, useState } from 'react'
import RosterTile from '@/app/components/RosterTile'
import { db } from '@/app/services/initializeFirebase.js' // Ensure storage is exported from initializeFirebase.js
import { collection, getDocs } from 'firebase/firestore'
import styles from '@/app/styles/Roster.module.css'

const RosterList = () => {
  // create roster list then loop through
  const [mensRoster, setMensRoster] = useState([]) // State to hold the fetched teams
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'teams'))
        const teamsData = querySnapshot.docs.map((doc) => doc.data())
        const mensTeam = teamsData.find(
          (team) => team.name === 'University of California, Los Angeles (M)'
        )
        const playersArray = mensTeam.players.map((player) => ({
          firstName: player.firstName,
          lastName: player.lastName,
          photoUrl: player.photo
        }))
        setMensRoster(playersArray)
      } catch (error) {
        console.error('Error retrieving teams:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTeams()
  }, [])

  return (
    // entire container
    <div className={styles.rosterContainer}>
      <h1>Roster</h1>
      <div>
        {/* Loop through roster  */}
        {loading
          ? Array(8)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className={`${styles.rosterTile} ${styles.placeholderTile}`}
                />
              ))
          : mensRoster.map((player, index) => (
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
