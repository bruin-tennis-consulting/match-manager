'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/app/services/initializeFirebase.js'
import styles from '@/app/styles/TeamManagement.module.css'
import Image from 'next/image'

export default function TeamManagement() {
  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState('')
  const [error, setError] = useState(null)
  const [message] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchTeams = useCallback(async () => {
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
      }
    } catch (err) {
      console.error('Error fetching teams:', err)
      setError('Failed to load teams')
    }
  }, [selectedTeam])

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  const handleTeamChange = (e) => {
    setSelectedTeam(e.target.value)
  }

  const handleSearch = (e) => {
    setSearchQuery(e.target.value)
  }

  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedTeamData = teams.find((team) => team.id === selectedTeam)

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Team Management</h1>

      {message && <div className={styles.message}>{message}</div>}
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.mainContent}>
        <div className={styles.teamsPanel}>
          <h2>Teams</h2>
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={handleSearch}
            className={styles.searchInput}
          />
          <select
            className={styles.teamSelect}
            value={selectedTeam}
            onChange={handleTeamChange}
          >
            {filteredTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        {selectedTeamData && (
          <div className={styles.teamDetailsPanel}>
            <h2>Team Details</h2>
            <div className={styles.teamCard}>
              <h3>{selectedTeamData.name}</h3>

              {selectedTeamData.logoUrl && (
                <div className={styles.logoContainer}>
                  <Image
                    src={selectedTeamData.logoUrl || '/images/default-logo.svg'}
                    alt={selectedTeamData.name}
                    width={150}
                    height={150}
                    onError={(e) => {
                      if (e.target.src !== '/images/default-logo.svg') {
                        e.target.src = '/images/default-logo.svg'
                      } else {
                        e.target.style.display = 'none'
                      }
                    }}
                  />
                </div>
              )}

              <div className={styles.teamInfo}>
                <p>
                  <strong>Players:</strong>{' '}
                  {selectedTeamData.players?.length || 0}
                </p>
                <p>
                  <strong>Gender:</strong>{' '}
                  {selectedTeamData.gender || 'Not specified'}
                </p>
                <p>
                  <strong>Division:</strong>{' '}
                  {selectedTeamData.division || 'Not specified'}
                </p>
              </div>

              {selectedTeamData.players &&
                selectedTeamData.players.length > 0 && (
                  <div className={styles.playersList}>
                    <h4>Players</h4>
                    <div className={styles.playersGrid}>
                      {selectedTeamData.players.map((player, index) => (
                        <div key={index} className={styles.playerCard}>
                          {player.photo && (
                            <div className={styles.playerImage}>
                              <Image
                                src={player.photo || '/images/default-logo.svg'}
                                alt={`${player.firstName} ${player.lastName}`}
                                width={60}
                                height={60}
                                onError={(e) => {
                                  if (
                                    e.target.src !== '/images/default-logo.svg'
                                  ) {
                                    e.target.src = '/images/default-logo.svg'
                                  } else {
                                    e.target.style.display = 'none'
                                  }
                                }}
                              />
                            </div>
                          )}
                          <div className={styles.playerInfo}>
                            <p className={styles.playerName}>
                              {player.firstName} {player.lastName}
                            </p>
                            {player.UTR && (
                              <p className={styles.playerUTR}>
                                UTR: {player.UTR}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
