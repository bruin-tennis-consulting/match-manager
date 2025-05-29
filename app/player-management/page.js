'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  addDoc
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/app/services/initializeFirebase.js'
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
  const [teamSearchQuery, setTeamSearchQuery] = useState('')

  // State for new team modal
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamLogoFile, setNewTeamLogoFile] = useState(null)
  const [newTeamNameError, setNewTeamNameError] = useState('')
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)
  const newTeamNameInputRef = useRef(null)

  // State for new player modal
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false)
  const [newPlayer, setNewPlayer] = useState({
    firstName: '',
    lastName: '',
    photo: '',
    bio: '',
    class: 'Freshman',
    height: '',
    age: '',
    hand: 'right',
    heightFeet: '',
    heightInches: ''
  })
  const [playerHeadPhotoFile, setPlayerHeadPhotoFile] = useState(null)
  const [playerLargePhotoFile, setPlayerLargePhotoFile] = useState(null)
  const [showEditPlayerModal, setShowEditPlayerModal] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState(null)

  const classOptions = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate']

  const fetchPlayers = useCallback(async (teamId) => {
    if (!teamId) return // Don't fetch if no team is selected

    try {
      setLoading(true)
      const teamSnapshot = await getDocs(
        query(collection(db, 'teams'), where('__name__', '==', teamId))
      )

      if (!teamSnapshot.empty) {
        const teamData = teamSnapshot.docs[0].data()
        setPlayers(teamData.players || [])
      } else {
        setPlayers([])
      }
    } catch (err) {
      console.error('Error fetching players:', err)
      setError('Failed to load players')
    } finally {
      setLoading(false)
    }
  }, []) // Empty dependency array since it doesn't use any external values

  const fetchTeams = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'teams'))
      const teamsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }))
      const sortedTeams = teamsData.sort((a, b) => a.name.localeCompare(b.name))
      setTeams(sortedTeams)
    } catch (err) {
      console.error('Error fetching teams:', err)
      setError('Failed to load teams')
    }
  }, []) // Empty dependency array since it doesn't use any external values

  // Initial load of teams
  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  // Set initial selected team after teams are loaded
  useEffect(() => {
    if (teams.length > 0 && !selectedTeam) {
      setSelectedTeam(teams[0].id)
    }
  }, [teams, selectedTeam])

  // Fetch players when selected team changes
  useEffect(() => {
    if (selectedTeam) {
      fetchPlayers(selectedTeam)
    }
  }, [selectedTeam, fetchPlayers])

  const handleTeamChange = (e) => {
    const teamId = e.target.value
    setSelectedTeam(teamId)
  }

  const handlePlayerSelect = (player) => {
    setSelectedPlayer(player)

    // Automatically filter target teams to opposite gender from current team
    const currentTeam = teams.find((team) => team.id === selectedTeam)
    if (currentTeam) {
      const currentGender = currentTeam.name.includes('(M)') ? 'M' : 'W'
      const oppositeGender = currentGender === 'M' ? 'W' : 'M'

      // Find the matching team in the opposite gender
      const baseTeamName = currentTeam.name.replace(`(${currentGender})`, '')
      const matchingOppositeTeams = teams.filter(
        (team) =>
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
      const sourceTeamSnapshot = await getDocs(
        query(collection(db, 'teams'), where('__name__', '==', selectedTeam))
      )
      const sourceTeamData = sourceTeamSnapshot.docs[0].data()

      // Get target team data
      const targetTeamSnapshot = await getDocs(
        query(collection(db, 'teams'), where('__name__', '==', targetTeam))
      )
      const targetTeamData = targetTeamSnapshot.docs[0].data()

      // Remove player from source team
      const updatedSourcePlayers = sourceTeamData.players.filter(
        (player) =>
          player.firstName !== selectedPlayer.firstName ||
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

      setMessage(
        `${selectedPlayer.firstName} ${selectedPlayer.lastName} moved successfully!`
      )
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

  const filteredPlayers = players.filter((player) => {
    const fullName = `${player.firstName} ${player.lastName}`.toLowerCase()
    return fullName.includes(searchQuery.toLowerCase())
  })

  // Filter teams for the main team selection dropdown based on teamSearchQuery
  const filteredDisplayTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(teamSearchQuery.toLowerCase())
  )

  const handleCreateTeamSubmit = async (event) => {
    if (event) event.preventDefault() // Prevent default form submission

    if (!newTeamName.trim()) {
      setNewTeamNameError('Team name cannot be empty.')
      return
    }
    // Add validation for logo file if it should be mandatory
    // if (!newTeamLogoFile) {
    //   setNewTeamNameError('Team logo is required.'); // Or a separate error state for logo
    //   return;
    // }
    setNewTeamNameError('') // Clear error if any
    setIsCreatingTeam(true)
    setMessage('') // Clear previous global messages

    try {
      const teamName = newTeamName.trim()
      // Optional: Check if team already exists (more robust check)
      // const q = query(collection(db, 'teams'), where('name', '==', teamName))
      // const querySnapshot = await getDocs(q)
      // if (!querySnapshot.empty) {
      //   setNewTeamNameError(`Team "${teamName}" already exists.`)
      //   setIsCreatingTeam(false)
      //   return
      // }

      const newTeamRef = await addDoc(collection(db, 'teams'), {
        name: teamName,
        players: []
        // logoURL: 'placeholder_url' // Placeholder for where logo URL would go after upload
      })

      // TODO: Actual file upload logic will go here.
      // For now, we just log the file and team ID.
      if (newTeamLogoFile) {
        console.log(
          'Selected logo file for team:',
          newTeamRef.id,
          newTeamLogoFile.name
        )
        // Example: await uploadTeamLogo(newTeamRef.id, newTeamLogoFile);
        // And then update the team document with the logoURL
      }

      setNewTeamName('')
      setNewTeamLogoFile(null) // Clear the selected file
      setShowCreateTeamModal(false)
      setMessage(`Team "${teamName}" created successfully!`) // Use global message for success

      // Fetch teams again to include the new one
      await fetchTeams() // Ensure teams list is updated

      // Auto-select the new team
      setSelectedTeam(newTeamRef.id)
      // fetchPlayers(newTeamRef.id) will be triggered by useEffect watching selectedTeam or by handleTeamChange if called directly
    } catch (err) {
      console.error('Error creating team:', err)
      // Set error in modal if it's still open, or use global message
      setNewTeamNameError('Failed to create team. ' + err.message) // Show error in modal
      setMessage('') // Or use: setMessage('Failed to create team. Please try again.')
    } finally {
      setIsCreatingTeam(false)
    }
  }

  const handleAddPlayer = async () => {
    if (!selectedTeam) {
      setMessage('Please select a team first.')
      return
    }
    if (!newPlayer.firstName.trim() || !newPlayer.lastName.trim()) {
      setMessage('First name and last name are required.')
      return
    }
    // Add more validation as needed for new fields

    try {
      setLoading(true)
      const teamRef = doc(db, 'teams', selectedTeam)
      const teamSnapshot = await getDocs(
        query(collection(db, 'teams'), where('__name__', '==', selectedTeam))
      )

      if (teamSnapshot.empty) {
        setMessage('Selected team not found.')
        setLoading(false)
        return
      }

      const teamData = teamSnapshot.docs[0].data()

      // Construct the player object to be added
      const playerToAdd = {
        firstName: newPlayer.firstName.trim(),
        lastName: newPlayer.lastName.trim(),
        bio: newPlayer.bio.trim(),
        class: newPlayer.class,
        age: newPlayer.age,
        hand: newPlayer.hand,
        height:
          (newPlayer.heightFeet || '0') +
          "'" +
          (newPlayer.heightInches || '0') +
          '"' // Combine feet and inches
        // photoURL: 'placeholder_headshot.jpg', // Placeholder for headshot URL
        // largePhotoURL: 'placeholder_large.jpg' // Placeholder for large photo URL
      }

      const updatedPlayers = [...(teamData.players || []), playerToAdd]

      await updateDoc(teamRef, {
        players: updatedPlayers
      })

      // TODO: Actual file upload logic for player photos will go here.
      if (playerHeadPhotoFile) {
        console.log(
          'Selected Player Head Photo:',
          playerHeadPhotoFile.name,
          'for player:',
          playerToAdd.firstName
        )
        // Example: await uploadPlayerPhoto(newTeamId, playerHeadPhotoFile, 'headshot');
      }
      if (playerLargePhotoFile) {
        console.log(
          'Selected Player Large Photo:',
          playerLargePhotoFile.name,
          'for player:',
          playerToAdd.firstName
        )
        // Example: await uploadPlayerPhoto(newTeamId, playerLargePhotoFile, 'large');
      }

      setMessage(
        `${playerToAdd.firstName} ${playerToAdd.lastName} added to ${teams.find((t) => t.id === selectedTeam)?.name || 'the team'} successfully!`
      )
      setNewPlayer({
        firstName: '',
        lastName: '',
        photo: '',
        bio: '',
        class: 'Freshman',
        height: '',
        age: '',
        hand: 'right',
        heightFeet: '',
        heightInches: ''
      })
      setPlayerHeadPhotoFile(null)
      setPlayerLargePhotoFile(null)
      setShowAddPlayerModal(false)
      fetchPlayers(selectedTeam) // Refresh players list
      setLoading(false)
    } catch (err) {
      console.error('Error adding player:', err)
      setMessage('Failed to add player. ' + err.message)
      setLoading(false)
    }
  }

  const handleEditClick = (player) => {
    setEditingPlayer({
      ...player,
      heightFeet: player.height ? player.height.split("'")[0] : '',
      heightInches: player.height
        ? player.height.split("'")[1].replace('"', '')
        : ''
    })
    setShowEditPlayerModal(true)
  }

  const handleEditSubmit = async () => {
    if (!editingPlayer || !selectedTeam) {
      setMessage('Unable to update player information.')
      return
    }

    try {
      setLoading(true)
      const teamRef = doc(db, 'teams', selectedTeam)
      const teamSnapshot = await getDocs(
        query(collection(db, 'teams'), where('__name__', '==', selectedTeam))
      )

      if (teamSnapshot.empty) {
        setMessage('Selected team not found.')
        setLoading(false)
        return
      }

      const teamData = teamSnapshot.docs[0].data()

      // Create updated player object
      const updatedPlayer = {
        ...editingPlayer,
        height:
          (editingPlayer.heightFeet || '0') +
          "'" +
          (editingPlayer.heightInches || '0') +
          '"' // Combine feet and inches
      }
      delete updatedPlayer.heightFeet
      delete updatedPlayer.heightInches

      // Handle photo uploads if new photos were selected
      if (playerHeadPhotoFile) {
        try {
          const headPhotoRef = ref(
            storage,
            `player-photos/${playerHeadPhotoFile.name}`
          )
          const headPhotoSnapshot = await uploadBytes(
            headPhotoRef,
            playerHeadPhotoFile
          )
          const headPhotoUrl = await getDownloadURL(headPhotoSnapshot.ref)
          updatedPlayer.photo = headPhotoUrl
        } catch (err) {
          console.error('Error uploading head photo:', err)
          setMessage('Failed to upload head photo. ' + err.message)
          return
        }
      }

      if (playerLargePhotoFile) {
        try {
          const largePhotoRef = ref(
            storage,
            `player-photos/${playerLargePhotoFile.name}`
          )
          const largePhotoSnapshot = await uploadBytes(
            largePhotoRef,
            playerLargePhotoFile
          )
          const largePhotoUrl = await getDownloadURL(largePhotoSnapshot.ref)
          updatedPlayer.largePlayerPhoto = largePhotoUrl
        } catch (err) {
          console.error('Error uploading large photo:', err)
          setMessage('Failed to upload large photo. ' + err.message)
          return
        }
      }

      // Update the player in the players array
      const updatedPlayers = teamData.players.map((player) =>
        player.firstName === selectedPlayer.firstName &&
        player.lastName === selectedPlayer.lastName
          ? updatedPlayer
          : player
      )

      await updateDoc(teamRef, {
        players: updatedPlayers
      })

      setMessage('Player updated successfully!')
      setShowEditPlayerModal(false)
      setEditingPlayer(null)
      setPlayerHeadPhotoFile(null)
      setPlayerLargePhotoFile(null)
      setSelectedPlayer(updatedPlayer)
      fetchPlayers(selectedTeam)
    } catch (err) {
      console.error('Error updating player:', err)
      setMessage('Failed to update player. ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (showCreateTeamModal && newTeamNameInputRef.current) {
      newTeamNameInputRef.current.focus()
    }
  }, [showCreateTeamModal])

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Player Management</h1>

      {message && <div className={styles.message}>{message}</div>}

      <div className={styles.mainContent}>
        <div className={styles.teamsPanel}>
          <h2>Teams</h2>
          <input
            type="text"
            placeholder="Search teams..."
            value={teamSearchQuery}
            onChange={(e) => setTeamSearchQuery(e.target.value)}
            className={styles.searchInput} // Reuse existing searchInput style or create new
            style={{ marginBottom: '0.5rem' }} // Add a little space below search bar
          />
          <select
            className={styles.teamSelect}
            value={selectedTeam}
            onChange={handleTeamChange}
            disabled={!filteredDisplayTeams.length} // Disable if no teams match search
          >
            {filteredDisplayTeams.length === 0 && teamSearchQuery !== '' ? (
              <option value="" disabled>
                No teams match &quot;{teamSearchQuery}&quot;
              </option>
            ) : (
              filteredDisplayTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))
            )}
          </select>
          <button
            className={styles.actionButton}
            onClick={() => setShowCreateTeamModal(true)}
          >
            Create New Team
          </button>
        </div>

        {/* Create Team Modal */}
        {showCreateTeamModal && (
          <div className={styles.modal}>
            <form
              onSubmit={handleCreateTeamSubmit}
              className={styles.modalContent}
            >
              <span
                className={styles.closeButton}
                onClick={() => {
                  setShowCreateTeamModal(false)
                  setNewTeamNameError('') // Clear error when closing manually
                  setNewTeamName('') // Clear name
                  setNewTeamLogoFile(null) // Clear file
                }}
              >
                &times;
              </span>
              <h2>Create New Team</h2>
              <input
                ref={newTeamNameInputRef}
                type="text"
                placeholder="Team Name"
                value={newTeamName}
                onChange={(e) => {
                  setNewTeamName(e.target.value)
                  if (newTeamNameError) setNewTeamNameError('') // Clear error on type
                }}
                className={styles.modalInput}
                disabled={isCreatingTeam}
              />
              <label htmlFor="teamLogoUpload" className={styles.fileInputLabel}>
                Logo File (png or jpg):
              </label>
              <input
                id="teamLogoUpload"
                type="file"
                accept=".png,.jpg,.jpeg"
                onChange={(e) => setNewTeamLogoFile(e.target.files[0])}
                className={styles.modalInput} // Can use same style or create a new one
                disabled={isCreatingTeam}
              />
              {newTeamLogoFile && (
                <p className={styles.fileNameDisplay}>
                  Selected file: {newTeamLogoFile.name}
                </p>
              )}
              {newTeamNameError && (
                <p className={styles.inputError}>{newTeamNameError}</p>
              )}
              <button
                type="submit"
                className={styles.modalButton}
                disabled={
                  !newTeamName.trim() ||
                  isCreatingTeam /* || !newTeamLogoFile (if mandatory) */
                }
              >
                {isCreatingTeam ? 'Creating...' : 'Create Team'}
              </button>
            </form>
          </div>
        )}

        <div className={styles.playersPanel}>
          <h2>Players</h2>
          <input
            type="text"
            placeholder="Search players..."
            value={searchQuery}
            onChange={handleSearch}
            className={styles.searchInput}
          />
          <button
            className={styles.actionButton}
            onClick={() => setShowAddPlayerModal(true)}
            disabled={!selectedTeam}
          >
            Add New Player
          </button>

          {/* Add Player Modal */}
          {showAddPlayerModal && (
            <div className={styles.modal}>
              <div className={styles.modalContent}>
                <span
                  className={styles.closeButton}
                  onClick={() => {
                    setShowAddPlayerModal(false)
                    // Reset player form states fully
                    setNewPlayer({
                      firstName: '',
                      lastName: '',
                      photo: '',
                      bio: '',
                      class: 'Freshman',
                      height: '',
                      age: '',
                      hand: 'right',
                      heightFeet: '',
                      heightInches: ''
                    })
                    setPlayerHeadPhotoFile(null)
                    setPlayerLargePhotoFile(null)
                  }}
                >
                  &times;
                </span>
                <h2>
                  Add New Player to{' '}
                  {teams.find((t) => t.id === selectedTeam)?.name}
                </h2>
                <input
                  type="text"
                  placeholder="First Name"
                  value={newPlayer.firstName}
                  onChange={(e) =>
                    setNewPlayer({ ...newPlayer, firstName: e.target.value })
                  }
                  className={styles.modalInput}
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={newPlayer.lastName}
                  onChange={(e) =>
                    setNewPlayer({ ...newPlayer, lastName: e.target.value })
                  }
                  className={styles.modalInput}
                />
                <input
                  type="text"
                  placeholder="Photo URL"
                  value={newPlayer.photo}
                  onChange={(e) =>
                    setNewPlayer({ ...newPlayer, photo: e.target.value })
                  }
                  className={styles.modalInput}
                />
                <textarea
                  placeholder="Bio"
                  value={newPlayer.bio}
                  onChange={(e) =>
                    setNewPlayer({ ...newPlayer, bio: e.target.value })
                  }
                  className={styles.modalTextarea}
                />
                <input
                  type="text"
                  placeholder="Class (e.g., Freshman, Sophomore)"
                  value={newPlayer.class}
                  onChange={(e) =>
                    setNewPlayer({ ...newPlayer, class: e.target.value })
                  }
                  className={styles.modalInput}
                />
                <input
                  type="text"
                  placeholder="Height (e.g., 6'1&quot;)"
                  value={newPlayer.height}
                  onChange={(e) =>
                    setNewPlayer({ ...newPlayer, height: e.target.value })
                  }
                  className={styles.modalInput}
                />
                <input
                  type="number"
                  placeholder="Age"
                  value={newPlayer.age}
                  onChange={(e) =>
                    setNewPlayer({ ...newPlayer, age: e.target.value })
                  }
                  className={styles.modalInput}
                />
                {/* Hand Radio Buttons */}
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Hand:</label>
                  <div className={styles.radioGroup}>
                    <label>
                      <input
                        type="radio"
                        name="playerHand"
                        value="right"
                        checked={newPlayer.hand === 'right'}
                        onChange={(e) =>
                          setNewPlayer({ ...newPlayer, hand: e.target.value })
                        }
                      />{' '}
                      Right
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="playerHand"
                        value="left"
                        checked={newPlayer.hand === 'left'}
                        onChange={(e) =>
                          setNewPlayer({ ...newPlayer, hand: e.target.value })
                        }
                      />{' '}
                      Left
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="playerHand"
                        value="ambidextrous"
                        checked={newPlayer.hand === 'ambidextrous'}
                        onChange={(e) =>
                          setNewPlayer({ ...newPlayer, hand: e.target.value })
                        }
                      />{' '}
                      Ambidextrous
                    </label>
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  {' '}
                  {/* For Age and Class side-by-side */}
                  <label className={styles.inputLabel}>
                    Age:
                    <input
                      type="number"
                      placeholder="Age"
                      value={newPlayer.age}
                      onChange={(e) =>
                        setNewPlayer({ ...newPlayer, age: e.target.value })
                      }
                      className={styles.modalInput}
                    />
                  </label>
                  <label className={styles.inputLabel}>
                    Class:
                    <select
                      value={newPlayer.class}
                      onChange={(e) =>
                        setNewPlayer({ ...newPlayer, class: e.target.value })
                      }
                      className={
                        styles.modalInput
                      } /* Or a specific select style */
                    >
                      {classOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className={styles.inputGroup}>
                  {' '}
                  {/* For Height Feet and Inches */}
                  <label className={styles.inputLabel}>Height:</label>
                  <input
                    type="number"
                    placeholder="Feet"
                    min="0"
                    value={newPlayer.heightFeet}
                    onChange={(e) =>
                      setNewPlayer({ ...newPlayer, heightFeet: e.target.value })
                    }
                    className={styles.modalInputSmall}
                  />
                  <span>&apos;&nbsp;</span>
                  <input
                    type="number"
                    placeholder="Inches"
                    min="0"
                    max="11"
                    value={newPlayer.heightInches}
                    onChange={(e) =>
                      setNewPlayer({
                        ...newPlayer,
                        heightInches: e.target.value
                      })
                    }
                    className={styles.modalInputSmall}
                  />
                </div>

                <label
                  htmlFor="playerHeadPhoto"
                  className={styles.fileInputLabel}
                >
                  Player Head Photo (webp, svg, png, jpg):
                </label>
                <input
                  id="playerHeadPhoto"
                  type="file"
                  accept="image/webp,image/svg+xml,image/png,image/jpeg"
                  onChange={(e) => setPlayerHeadPhotoFile(e.target.files[0])}
                  className={styles.modalInput}
                />
                {playerHeadPhotoFile && (
                  <p className={styles.fileNameDisplay}>
                    Selected: {playerHeadPhotoFile.name}
                  </p>
                )}

                <label
                  htmlFor="playerLargePhoto"
                  className={styles.fileInputLabel}
                >
                  Large Player Photo (webp, svg, png, jpg):
                </label>
                <input
                  id="playerLargePhoto"
                  type="file"
                  accept="image/webp,image/svg+xml,image/png,image/jpeg"
                  onChange={(e) => setPlayerLargePhotoFile(e.target.files[0])}
                  className={styles.modalInput}
                />
                {playerLargePhotoFile && (
                  <p className={styles.fileNameDisplay}>
                    Selected: {playerLargePhotoFile.name}
                  </p>
                )}

                <button
                  onClick={handleAddPlayer}
                  className={styles.modalButton}
                >
                  Add Player
                </button>
              </div>
            </div>
          )}

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
                        style={{ objectFit: 'cover' }}
                        priority={index < 4} // Prioritize loading first 4 images
                      />
                    ) : (
                      <div className={styles.noImage}>No Image</div>
                    )}
                  </div>
                  <div className={styles.playerInfo}>
                    <h3>
                      {player.firstName} {player.lastName}
                    </h3>
                    <p>{player.bio}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedPlayer && (
          <div className={styles.assignPanel}>
            <h2>Player Details</h2>
            <div className={styles.selectedPlayerCard}>
              <h3>
                {selectedPlayer.firstName} {selectedPlayer.lastName}
              </h3>
              {selectedPlayer.photo && (
                <Image
                  src={selectedPlayer.photo}
                  alt={`${selectedPlayer.firstName} ${selectedPlayer.lastName}`}
                  width={150}
                  height={150}
                  style={{ objectFit: 'cover' }}
                  priority
                />
              )}
              <p>
                <strong>Bio:</strong> {selectedPlayer.bio || 'No bio available'}
              </p>
              <p>
                <strong>Class:</strong> {selectedPlayer.class || 'N/A'}
              </p>
              <p>
                <strong>Height:</strong> {selectedPlayer.height || 'N/A'}
              </p>
              <p>
                <strong>Age:</strong> {selectedPlayer.age || 'N/A'}
              </p>
              <button
                onClick={() => handleEditClick(selectedPlayer)}
                className={styles.editButton}
              >
                Edit Player
              </button>
            </div>

            {/* Edit Player Modal */}
            {showEditPlayerModal && editingPlayer && (
              <div className={styles.modal}>
                <div className={styles.modalContent}>
                  <span
                    className={styles.closeButton}
                    onClick={() => {
                      setShowEditPlayerModal(false)
                      setEditingPlayer(null)
                      setPlayerHeadPhotoFile(null)
                      setPlayerLargePhotoFile(null)
                    }}
                  >
                    &times;
                  </span>
                  <h2>Edit Player</h2>
                  <input
                    type="text"
                    placeholder="First Name"
                    value={editingPlayer.firstName}
                    onChange={(e) =>
                      setEditingPlayer({
                        ...editingPlayer,
                        firstName: e.target.value
                      })
                    }
                    className={styles.modalInput}
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={editingPlayer.lastName}
                    onChange={(e) =>
                      setEditingPlayer({
                        ...editingPlayer,
                        lastName: e.target.value
                      })
                    }
                    className={styles.modalInput}
                  />
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Hand:</label>
                    <div className={styles.radioGroup}>
                      <label>
                        <input
                          type="radio"
                          checked={editingPlayer.hand === 'right'}
                          onChange={() =>
                            setEditingPlayer({
                              ...editingPlayer,
                              hand: 'right'
                            })
                          }
                        />{' '}
                        Right
                      </label>
                      <label>
                        <input
                          type="radio"
                          checked={editingPlayer.hand === 'left'}
                          onChange={() =>
                            setEditingPlayer({ ...editingPlayer, hand: 'left' })
                          }
                        />{' '}
                        Left
                      </label>
                      <label>
                        <input
                          type="radio"
                          checked={editingPlayer.hand === 'ambidextrous'}
                          onChange={() =>
                            setEditingPlayer({
                              ...editingPlayer,
                              hand: 'ambidextrous'
                            })
                          }
                        />{' '}
                        Ambidextrous
                      </label>
                    </div>
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>
                      Age:
                      <input
                        type="number"
                        value={editingPlayer.age}
                        onChange={(e) =>
                          setEditingPlayer({
                            ...editingPlayer,
                            age: e.target.value
                          })
                        }
                        className={styles.modalInput}
                      />
                    </label>
                    <label className={styles.inputLabel}>
                      Class:
                      <select
                        value={editingPlayer.class}
                        onChange={(e) =>
                          setEditingPlayer({
                            ...editingPlayer,
                            class: e.target.value
                          })
                        }
                        className={styles.modalInput}
                      >
                        {classOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Height:</label>
                    <input
                      type="number"
                      placeholder="Feet"
                      min="0"
                      value={editingPlayer.heightFeet}
                      onChange={(e) =>
                        setEditingPlayer({
                          ...editingPlayer,
                          heightFeet: e.target.value
                        })
                      }
                      className={styles.modalInputSmall}
                    />
                    <span>&apos;&nbsp;</span>
                    <input
                      type="number"
                      placeholder="Inches"
                      min="0"
                      max="11"
                      value={editingPlayer.heightInches}
                      onChange={(e) =>
                        setEditingPlayer({
                          ...editingPlayer,
                          heightInches: e.target.value
                        })
                      }
                      className={styles.modalInputSmall}
                    />
                  </div>
                  <label
                    htmlFor="editPlayerHeadPhoto"
                    className={styles.fileInputLabel}
                  >
                    Update Player Head Photo (webp, svg, png, jpg):
                  </label>
                  <input
                    id="editPlayerHeadPhoto"
                    type="file"
                    accept="image/webp,image/svg+xml,image/png,image/jpeg"
                    onChange={(e) => setPlayerHeadPhotoFile(e.target.files[0])}
                    className={styles.modalInput}
                  />
                  {playerHeadPhotoFile && (
                    <p className={styles.fileNameDisplay}>
                      Selected: {playerHeadPhotoFile.name}
                    </p>
                  )}
                  <label
                    htmlFor="editPlayerLargePhoto"
                    className={styles.fileInputLabel}
                  >
                    Update Large Player Photo (webp, svg, png, jpg):
                  </label>
                  <input
                    id="editPlayerLargePhoto"
                    type="file"
                    accept="image/webp,image/svg+xml,image/png,image/jpeg"
                    onChange={(e) => setPlayerLargePhotoFile(e.target.files[0])}
                    className={styles.modalInput}
                  />
                  {playerLargePhotoFile && (
                    <p className={styles.fileNameDisplay}>
                      Selected: {playerLargePhotoFile.name}
                    </p>
                  )}
                  <textarea
                    placeholder="Bio"
                    value={editingPlayer.bio}
                    onChange={(e) =>
                      setEditingPlayer({
                        ...editingPlayer,
                        bio: e.target.value
                      })
                    }
                    className={styles.modalTextarea}
                  />
                  <button
                    onClick={handleEditSubmit}
                    className={styles.modalButton}
                  >
                    Update Player
                  </button>
                </div>
              </div>
            )}

            <div className={styles.targetTeamSelect}>
              <h3>Select Target Team</h3>
              <select
                value={targetTeam}
                onChange={(e) => setTargetTeam(e.target.value)}
              >
                {filteredTeams.map((team) => (
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
