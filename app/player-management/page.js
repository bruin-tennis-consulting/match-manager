'use client'
import React, { useState, useEffect } from 'react'
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/app/services/initializeFirebase.js'
import styles from '@/app/styles/PlayerManagement.module.css'
import Image from 'next/image'

export default function PlayerManagement() {
  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState('')
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [targetTeam, setTargetTeam] = useState('')
  const [filteredTeams, setFilteredTeams] = useState([])
  const [searchQuery, setSearchQuery] = useState('')

  const fetchTeams = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'teams'))
      const teamsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }))
      const sortedTeams = teamsData.sort((a, b) => a.name.localeCompare(b.name))
      setTeams(sortedTeams)
      
      // If no team is selected yet and we have teams, select the first one
      if (!selectedTeam && sortedTeams.length > 0) {
        setSelectedTeam(sortedTeams[0].id)
        fetchPlayers(sortedTeams[0].id)
      }
      
      setLoading(false)
    } catch (err) {
      console.error('Error fetching teams:', err)
      setError('Failed to load teams')
      setLoading(false)
    }
  }

  const fetchPlayers = async (teamId) => {
    try {
      setLoading(true)
      const teamSnapshot = await getDocs(query(collection(db, 'teams'), where('__name__', '==', teamId)))
      
      if (!teamSnapshot.empty) {
        const teamData = teamSnapshot.docs[0].data()
        setPlayers(teamData.players || [])
      } else {
        setPlayers([])
      }
      setLoading(false)
    } catch (err) {
      console.error('Error fetching players:', err)
      setError('Failed to load players')
      setLoading(false)
    }
  }

  const handleTeamChange = (e) => {
    const teamId = e.target.value
    setSelectedTeam(teamId)
    fetchPlayers(teamId)
  }

  const handlePlayerSelect = (player) => {
    setSelectedPlayer(player)
    
    // Automatically filter target teams to opposite gender from current team
    const currentTeam = teams.find(team => team.id === selectedTeam)
    if (currentTeam) {
      const currentGender = currentTeam.name.includes('(M)') ? 'M' : 'W'
      const oppositeGender = currentGender === 'M' ? 'W' : 'M'
      
      // Find the matching team in the opposite gender
      const baseTeamName = currentTeam.name.replace(`(${currentGender})`, '')
      const matchingOppositeTeams = teams.filter(team => 
        team.name.includes(baseTeamName) && 
        team.name.includes(`(${oppositeGender})`)
      )
      
      setFilteredTeams(matchingOppositeTeams)
      
      if (matchingOppositeTeams.length > 0) {
        setTargetTeam(matchingOppositeTeams[0].id)
      }
    }
  }

  const handleAssignPlayer = async () => {
    if (!selectedPlayer || !targetTeam) {
      setMessage('Please select a player and target team')
      return
    }

    try {
      setLoading(true)
      
      // Get current team data
      const sourceTeamSnapshot = await getDocs(query(collection(db, 'teams'), where('__name__', '==', selectedTeam)))
      const sourceTeamData = sourceTeamSnapshot.docs[0].data()
      
      // Get target team data
      const targetTeamSnapshot = await getDocs(query(collection(db, 'teams'), where('__name__', '==', targetTeam)))
      const targetTeamData = targetTeamSnapshot.docs[0].data()
      
      // Remove player from source team
      const updatedSourcePlayers = sourceTeamData.players.filter(
        player => player.firstName !== selectedPlayer.firstName || 
                 player.lastName !== selectedPlayer.lastName
      )
      
      // Add player to target team
      const targetPlayers = [...(targetTeamData.players || []), selectedPlayer]
      
      // Update source team
      await updateDoc(doc(db, 'teams', selectedTeam), {
        players: updatedSourcePlayers
      })
      
      // Update target team
      await updateDoc(doc(db, 'teams', targetTeam), {
        players: targetPlayers
      })
      
      setMessage(`${selectedPlayer.firstName} ${selectedPlayer.lastName} moved successfully!`)
      setSelectedPlayer(null)
      
      // Refresh players list
      fetchPlayers(selectedTeam)
      setLoading(false)
    } catch (err) {
      console.error('Error assigning player:', err)
      setMessage('Failed to move player')
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    setSearchQuery(e.target.value)
  }

  const filteredPlayers = players.filter(player => {
    const fullName = `${player.firstName} ${player.lastName}`.toLowerCase()
    return fullName.includes(searchQuery.toLowerCase())
  })

  useEffect(() => {
    fetchTeams()
  }, [])

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Player Management</h1>
      
      {message && <div className={styles.message}>{message}</div>}
      
      <div className={styles.mainContent}>
        <div className={styles.teamsPanel}>
          <h2>Teams</h2>
          <select 
            className={styles.teamSelect} 
            value={selectedTeam} 
            onChange={handleTeamChange}
          >
            {teams.map(team => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className={styles.playersPanel}>
          <h2>Players</h2>
          <input
            type="text"
            placeholder="Search players..."
            value={searchQuery}
            onChange={handleSearch}
            className={styles.searchInput}
          />
          
          {loading ? (
            <p>Loading players...</p>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : filteredPlayers.length === 0 ? (
            <p>No players found</p>
          ) : (
            <div className={styles.playersList}>
              {filteredPlayers.map((player, index) => (
                <div 
                  key={index} 
                  className={`${styles.playerCard} ${selectedPlayer === player ? styles.selected : ''}`}
                  onClick={() => handlePlayerSelect(player)}
                >
                  <div className={styles.playerImage}>
                    {player.photo ? (
                      <Image 
                        src={player.photo} 
                        alt={`${player.firstName} ${player.lastName}`} 
                        width={100} 
                        height={100} 
                      />
                    ) : (
                      <div className={styles.noImage}>No Image</div>
                    )}
                  </div>
                  <div className={styles.playerInfo}>
                    <h3>{player.firstName} {player.lastName}</h3>
                    <p>{player.bio}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {selectedPlayer && (
          <div className={styles.assignPanel}>
            <h2>Assign Player</h2>
            <div className={styles.selectedPlayerCard}>
              <h3>{selectedPlayer.firstName} {selectedPlayer.lastName}</h3>
              {selectedPlayer.photo && (
                <Image 
                  src={selectedPlayer.photo} 
                  alt={`${selectedPlayer.firstName} ${selectedPlayer.lastName}`} 
                  width={150} 
                  height={150} 
                />
              )}
              <p><strong>Bio:</strong> {selectedPlayer.bio || 'No bio available'}</p>
              <p><strong>Class:</strong> {selectedPlayer.class || 'N/A'}</p>
              <p><strong>Height:</strong> {selectedPlayer.height || 'N/A'}</p>
              <p><strong>Age:</strong> {selectedPlayer.age || 'N/A'}</p>
            </div>
            
            <div className={styles.targetTeamSelect}>
              <h3>Select Target Team</h3>
              <select 
                value={targetTeam} 
                onChange={(e) => setTargetTeam(e.target.value)}
              >
                {filteredTeams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              
              <button 
                className={styles.assignButton} 
                onClick={handleAssignPlayer}
                disabled={!targetTeam}
              >
                Assign to Team
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 