'use client'
import React, { useState, useEffect, useCallback } from 'react'
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  writeBatch
} from 'firebase/firestore'
import { db } from '@/app/services/initializeFirebase.js'
import styles from '@/app/styles/MatchManagement.module.css'
import Image from 'next/image'

export default function MatchManagement() {
  const [matches, setMatches] = useState([])
  const [teams, setTeams] = useState([])
  const [filteredTeams, setFilteredTeams] = useState([])
  const [collections] = useState(['UCLA (M)', 'UCLA (W)', 'demo', 'matches'])
  const [selectedCollection, setSelectedCollection] = useState('UCLA (M)')
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Team assignment states
  const [clientTeam, setClientTeam] = useState('')
  const [opponentTeam, setOpponentTeam] = useState('')

  // Batch update states
  const [showBatchUpdate, setShowBatchUpdate] = useState(false)
  const [oldTeamName, setOldTeamName] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [batchUpdateType, setBatchUpdateType] = useState('client') // 'client' or 'opponent'

  // JSON display state
  const [showRawJson, setShowRawJson] = useState(false)

  const filterTeamsByCollection = useCallback((teamsList, collectionName) => {
    // Make sure we have teams to filter
    if (!teamsList || teamsList.length === 0) {
      console.log('No teams to filter')
      return []
    }

    console.log(`Filtering teams for collection: ${collectionName}`)
    console.log(`Total teams before filtering: ${teamsList.length}`)

    // For UCLA collections, filter by gender
    if (collectionName === 'UCLA (M)') {
      // For men's collection, show only men's teams (M)
      const menTeams = teamsList.filter((team) => team.name.includes('(M)'))
      console.log(`Men's teams found: ${menTeams.length}`)
      return menTeams.length > 0 ? menTeams : teamsList
    } else if (collectionName === 'UCLA (W)') {
      // For women's collection, show only women's teams (W)
      const womenTeams = teamsList.filter((team) => team.name.includes('(W)'))
      console.log(`Women's teams found: ${womenTeams.length}`)
      return womenTeams.length > 0 ? womenTeams : teamsList
    } else {
      // For other collections, show all teams
      return teamsList
    }
  }, [])

  const fetchTeams = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'teams'))
      const teamsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }))
      const sortedTeams = teamsData.sort((a, b) => a.name.localeCompare(b.name))
      setTeams(sortedTeams)

      // Filter teams based on selected collection
      const filtered = filterTeamsByCollection(sortedTeams, selectedCollection)
      setFilteredTeams(filtered)

      setLoading(false)
    } catch (err) {
      console.error('Error fetching teams:', err)
      setError('Failed to load teams')
      setLoading(false)
    }
  }, [selectedCollection, filterTeamsByCollection])

  const fetchMatches = useCallback(async (collectionName) => {
    try {
      setLoading(true)
      const matchesCollection = collection(db, collectionName)
      const querySnapshot = await getDocs(matchesCollection)

      const matchesData = querySnapshot.docs
        .map((doc) => ({
          id: doc.id,
          collection: collectionName,
          ...doc.data()
        }))
        // Filter out deleted matches
        .filter((match) => !match._deleted)

      setMatches(matchesData)
      setSelectedMatch(null) // Reset selected match when collection changes

      setLoading(false)
    } catch (err) {
      console.error('Error fetching matches:', err)
      setError(`Failed to load matches from ${collectionName}`)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeams()
  }, [selectedCollection, fetchTeams])

  useEffect(() => {
    fetchMatches(selectedCollection)
  }, [selectedCollection, fetchMatches])

  const handleCollectionChange = (e) => {
    const collection = e.target.value
    setSelectedCollection(collection)
    fetchMatches(collection)

    // Also update team filtering
    filterTeamsByCollection(teams, collection)
  }

  const handleMatchSelect = (match) => {
    setSelectedMatch(match)

    // Set current teams for this match
    setClientTeam(match.client || '')
    setOpponentTeam(match.opponent || '')
  }

  const handleSearch = (e) => {
    setSearchQuery(e.target.value)
  }

  const handleUpdateMatch = async () => {
    if (!selectedMatch) {
      setMessage('Please select a match')
      return
    }

    if (!clientTeam && !opponentTeam) {
      setMessage('Please select at least one team to update')
      return
    }

    // Validate team gender based on collection
    if (
      selectedCollection === 'UCLA (M)' &&
      ((clientTeam && !clientTeam.includes('(M)')) ||
        (opponentTeam && !opponentTeam.includes('(M)')))
    ) {
      setMessage("For men's collection, teams must be men's teams (M)")
      return
    }

    if (
      selectedCollection === 'UCLA (W)' &&
      ((clientTeam && !clientTeam.includes('(W)')) ||
        (opponentTeam && !opponentTeam.includes('(W)')))
    ) {
      setMessage("For women's collection, teams must be women's teams (W)")
      return
    }

    try {
      setLoading(true)

      // Prepare update data
      const updateData = {}

      // Update root level team fields
      if (clientTeam) {
        updateData.client = clientTeam
        updateData.teams = {
          ...selectedMatch.teams,
          clientTeam
        }
      }
      if (opponentTeam) {
        updateData.opponent = opponentTeam
        updateData.teams = {
          ...selectedMatch.teams,
          opponentTeam
        }
      }

      // For UCLA (M) collection, update pointsJson data
      if (selectedCollection === 'UCLA (M)' && selectedMatch.pointsJson) {
        const updatedPointsJson = selectedMatch.pointsJson.map((point) => ({
          ...point,
          ...(clientTeam ? { clientTeam } : {}),
          ...(opponentTeam ? { opponentTeam } : {})
        }))
        updateData.pointsJson = updatedPointsJson
      }

      // For UCLA (W) collection, update points data
      if (selectedCollection === 'UCLA (W)' && selectedMatch.points) {
        const updatedPoints = selectedMatch.points.map((point) => ({
          ...point,
          ...(clientTeam ? { clientTeam } : {}),
          ...(opponentTeam ? { opponentTeam } : {})
        }))
        updateData.points = updatedPoints
      }

      // Update the match document
      const matchRef = doc(db, selectedCollection, selectedMatch.id)
      await updateDoc(matchRef, updateData)

      setMessage('Match updated successfully')

      // Refresh the matches list
      await fetchMatches(selectedCollection)

      // Clear the form
      setClientTeam('')
      setOpponentTeam('')
      setSelectedMatch(null)
    } catch (error) {
      console.error('Error updating match:', error)
      setMessage('Error updating match: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBatchUpdate = async () => {
    if (!oldTeamName || !newTeamName) {
      setMessage('Please select both old and new team names')
      return
    }

    // Validate team gender based on collection
    if (selectedCollection === 'UCLA (M)' && !newTeamName.includes('(M)')) {
      setMessage("For men's collection, the new team must be a men's team (M)")
      return
    }

    if (selectedCollection === 'UCLA (W)' && !newTeamName.includes('(W)')) {
      setMessage(
        "For women's collection, the new team must be a women's team (W)"
      )
      return
    }

    try {
      setLoading(true)
      setMessage('Processing batch update...')

      const batch = writeBatch(db)
      let updateCount = 0

      // Find all matches in the current collection that need updating
      const matchesToUpdate = matches.filter((match) =>
        batchUpdateType === 'client'
          ? match.client === oldTeamName
          : match.opponent === oldTeamName
      )

      // Prepare batch updates
      matchesToUpdate.forEach((match) => {
        const matchRef = doc(db, selectedCollection, match.id)
        const updateData =
          batchUpdateType === 'client'
            ? { client: newTeamName }
            : { opponent: newTeamName }

        batch.update(matchRef, updateData)
        updateCount++
      })

      // Commit batch if there are updates to make
      if (updateCount > 0) {
        await batch.commit()

        // Update local state
        setMatches((prev) =>
          prev.map((match) => {
            if (batchUpdateType === 'client' && match.client === oldTeamName) {
              return { ...match, client: newTeamName }
            } else if (
              batchUpdateType === 'opponent' &&
              match.opponent === oldTeamName
            ) {
              return { ...match, opponent: newTeamName }
            }
            return match
          })
        )

        setMessage(`Successfully updated ${updateCount} matches`)
      } else {
        setMessage(
          `No matches found with ${batchUpdateType === 'client' ? 'client' : 'opponent'} team "${oldTeamName}"`
        )
      }

      setLoading(false)
    } catch (err) {
      console.error('Error performing batch update:', err)
      setMessage('Failed to update matches')
      setLoading(false)
    }
  }

  const findTeamLogo = (teamName) => {
    if (!teamName) return null

    // Try exact match first
    const exactMatch = teams.find((t) => t.name === teamName)
    if (exactMatch) return exactMatch.logoUrl

    // Try with (M) suffix
    const withMSuffix = teams.find((t) => t.name === `${teamName} (M)`)
    if (withMSuffix) return withMSuffix.logoUrl

    // Try with (W) suffix
    const withWSuffix = teams.find((t) => t.name === `${teamName} (W)`)
    if (withWSuffix) return withWSuffix.logoUrl

    return null
  }

  // Get player names from match data
  const getPlayerNames = (match) => {
    const clientPlayer = match?.players?.client
    const opponentPlayer = match?.players?.opponent

    const clientName = clientPlayer
      ? `${clientPlayer.firstName} ${clientPlayer.lastName}`
      : 'Unknown player'

    const opponentName = opponentPlayer
      ? `${opponentPlayer.firstName} ${opponentPlayer.lastName}`
      : 'Unknown player'

    return { clientName, opponentName }
  }

  // Get match title for display
  const getMatchTitle = (match) => {
    // If players are available in the match data, use their names
    if (match.players) {
      const { clientName, opponentName } = getPlayerNames(match)
      return `${clientName} vs ${opponentName}`
    }

    // Otherwise fall back to team names
    return `${match.client || 'Unknown'} vs ${match.opponent || 'Unknown'}`
  }

  // Get suggested team name for client or opponent
  const getSuggestedTeam = (teamName, isClient = true) => {
    if (teamName && teams.some((t) => t.name === teamName)) {
      return teamName // Team name is valid
    }

    // If team name is missing or invalid, make a suggestion
    if (isClient) {
      // For client, suggest UCLA teams
      const uclaTeams = teams.filter(
        (team) =>
          team.name.includes('UCLA') ||
          team.name.includes('University of California, Los Angeles')
      )

      // Return appropriate UCLA team based on collection
      if (selectedCollection === 'UCLA (M)') {
        const uclaMens = uclaTeams.find((team) => team.name.includes('(M)'))
        return uclaMens ? uclaMens.name : 'UCLA (M)'
      } else if (selectedCollection === 'UCLA (W)') {
        const uclaWomens = uclaTeams.find((team) => team.name.includes('(W)'))
        return uclaWomens ? uclaWomens.name : 'UCLA (W)'
      } else {
        return uclaTeams[0]?.name || ''
      }
    } else {
      // For opponent, suggest non-UCLA teams based on current collection
      const nonUclaTeams = teams.filter(
        (team) =>
          !team.name.includes('UCLA') &&
          !team.name.includes('University of California, Los Angeles')
      )

      // Filter by gender if needed
      if (selectedCollection === 'UCLA (M)') {
        const menTeams = nonUclaTeams.filter((team) =>
          team.name.includes('(M)')
        )
        return menTeams[0]?.name || ''
      } else if (selectedCollection === 'UCLA (W)') {
        const womenTeams = nonUclaTeams.filter((team) =>
          team.name.includes('(W)')
        )
        return womenTeams[0]?.name || ''
      } else {
        return nonUclaTeams[0]?.name || ''
      }
    }
  }

  // Find similar team names
  const findSimilarTeams = (teamName) => {
    if (!teamName) return []

    const lowercaseName = teamName.toLowerCase()
    return teams
      .filter((team) => {
        const lowerTeamName = team.name.toLowerCase()

        // Check if team name contains any part of the input name
        return lowercaseName
          .split(' ')
          .some((part) => part.length > 2 && lowerTeamName.includes(part))
      })
      .slice(0, 5) // Limit to 5 suggestions
  }

  const filteredMatches = matches.filter((match) => {
    // If we have player data, include it in the search
    if (match.players) {
      const { clientName, opponentName } = getPlayerNames(match)
      const playerNames = `${clientName} ${opponentName}`.toLowerCase()
      if (playerNames.includes(searchQuery.toLowerCase())) {
        return true
      }
    }

    // Also search by team names
    const matchTitle =
      `${match.client || ''} vs ${match.opponent || ''}`.toLowerCase()
    return matchTitle.includes(searchQuery.toLowerCase())
  })

  // Count occurrences of each team name in matches
  const getTeamCounts = () => {
    const clientCounts = {}
    const opponentCounts = {}

    matches.forEach((match) => {
      if (match.client) {
        clientCounts[match.client] = (clientCounts[match.client] || 0) + 1
      }
      if (match.opponent) {
        opponentCounts[match.opponent] =
          (opponentCounts[match.opponent] || 0) + 1
      }
    })

    return { clientCounts, opponentCounts }
  }

  const { clientCounts, opponentCounts } = getTeamCounts()

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return 'No date'

    // Handle firestore timestamp
    if (dateStr.seconds) {
      return new Date(dateStr.seconds * 1000).toLocaleDateString()
    }

    // Handle string date
    if (typeof dateStr === 'string') {
      return dateStr
    }

    return 'Invalid date'
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Match Management</h1>

      {message && <div className={styles.message}>{message}</div>}

      <div className={styles.controls}>
        <button
          className={styles.toggleButton}
          onClick={() => setShowBatchUpdate(!showBatchUpdate)}
        >
          {showBatchUpdate ? 'Hide Batch Update' : 'Show Batch Update'}
        </button>
      </div>

      {showBatchUpdate && (
        <div className={styles.batchUpdatePanel}>
          <h2>Batch Update Team Names</h2>
          <p>
            Replace all occurrences of a team name in the current collection
          </p>

          <div className={styles.batchUpdateControls}>
            <div className={styles.updateTypeSelector}>
              <label>
                <input
                  type="radio"
                  checked={batchUpdateType === 'client'}
                  onChange={() => setBatchUpdateType('client')}
                />
                Update Client Teams
              </label>
              <label>
                <input
                  type="radio"
                  checked={batchUpdateType === 'opponent'}
                  onChange={() => setBatchUpdateType('opponent')}
                />
                Update Opponent Teams
              </label>
            </div>

            <div className={styles.teamSelectContainer}>
              <div className={styles.teamSelectGroup}>
                <label>Old Team Name:</label>
                <select
                  value={oldTeamName}
                  onChange={(e) => setOldTeamName(e.target.value)}
                  className={styles.teamSelect}
                >
                  <option value="">Select a team</option>
                  {Object.entries(
                    batchUpdateType === 'client' ? clientCounts : opponentCounts
                  )
                    .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
                    .map(([name, count]) => (
                      <option key={name} value={name}>
                        {name} ({count} matches)
                      </option>
                    ))}
                </select>

                {findTeamLogo(oldTeamName) && (
                  <div className={styles.selectedLogoContainer}>
                    <Image
                      src={findTeamLogo(oldTeamName)}
                      alt={oldTeamName}
                      width={60}
                      height={60}
                    />
                  </div>
                )}
              </div>

              <div className={styles.teamSelectGroup}>
                <label>New Team Name:</label>
                <select
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className={styles.teamSelect}
                >
                  <option value="">Select a team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.name}>
                      {team.name}
                    </option>
                  ))}
                </select>

                {findTeamLogo(newTeamName) && (
                  <div className={styles.selectedLogoContainer}>
                    <Image
                      src={findTeamLogo(newTeamName)}
                      alt={newTeamName}
                      width={60}
                      height={60}
                    />
                  </div>
                )}
              </div>
            </div>

            <button
              className={styles.batchUpdateButton}
              onClick={handleBatchUpdate}
              disabled={loading || !oldTeamName || !newTeamName}
            >
              {loading ? 'Updating...' : 'Update All Matches'}
            </button>
          </div>
        </div>
      )}

      <div className={styles.mainContent}>
        <div className={styles.collectionsPanel}>
          <h2>Collections</h2>
          <select
            className={styles.collectionSelect}
            value={selectedCollection}
            onChange={handleCollectionChange}
          >
            {collections.map((collection) => (
              <option key={collection} value={collection}>
                {collection}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search matches..."
            value={searchQuery}
            onChange={handleSearch}
            className={styles.searchInput}
          />

          <div className={styles.teamCount}>
            <p>Available Teams: {teams.length}</p>
            <p>Filtered Teams: {filteredTeams.length}</p>
          </div>

          <div className={styles.matchesList}>
            {loading ? (
              <p>Loading matches...</p>
            ) : error ? (
              <p className={styles.error}>{error}</p>
            ) : filteredMatches.length === 0 ? (
              <p>No matches found</p>
            ) : (
              filteredMatches.map((match) => (
                <div
                  key={match.id}
                  className={`${styles.matchItem} ${selectedMatch?.id === match.id ? styles.selected : ''}`}
                  onClick={() => handleMatchSelect(match)}
                >
                  <div className={styles.matchTeams}>
                    <span className={styles.teamName}>
                      {match.client || 'Unknown team'}
                    </span>
                    <span> vs </span>
                    <span className={styles.teamName}>
                      {match.opponent || 'Unknown team'}
                    </span>
                  </div>

                  {match.players && (
                    <div className={styles.playerNames}>
                      <span>{getPlayerNames(match).clientName}</span>
                      <span> vs </span>
                      <span>{getPlayerNames(match).opponentName}</span>
                    </div>
                  )}

                  <div className={styles.matchDate}>
                    {formatDate(match.date || match.matchDate)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {selectedMatch && (
          <div className={styles.matchDetailsPanel}>
            <h2>Match Details</h2>
            <div className={styles.matchCard}>
              <h3>{getMatchTitle(selectedMatch)}</h3>

              <div className={styles.teamsContainer}>
                <div className={styles.teamDisplay}>
                  <h4>Client Team</h4>
                  {findTeamLogo(selectedMatch.client) && (
                    <div className={styles.logoContainer}>
                      <Image
                        src={findTeamLogo(selectedMatch.client)}
                        alt={selectedMatch.client}
                        width={100}
                        height={100}
                      />
                    </div>
                  )}
                  {selectedMatch.client ? (
                    <p className={styles.teamNameDisplay}>
                      {selectedMatch.client}
                    </p>
                  ) : (
                    <p className={styles.missingTeam}>Unknown team</p>
                  )}

                  {/* Show suggestion if team is unknown */}
                  {(!selectedMatch.client ||
                    !teams.some((t) => t.name === selectedMatch.client)) && (
                    <div className={styles.teamSuggestion}>
                      <p>
                        Suggested:{' '}
                        {getSuggestedTeam(selectedMatch.client, true)}
                      </p>
                      <button
                        className={styles.applySuggestion}
                        onClick={() =>
                          setClientTeam(
                            getSuggestedTeam(selectedMatch.client, true)
                          )
                        }
                      >
                        Apply Suggestion
                      </button>

                      {/* Similar team suggestions */}
                      {selectedMatch.client && (
                        <div className={styles.similarTeams}>
                          <p className={styles.similarTitle}>Similar Teams:</p>
                          <div className={styles.suggestionsGrid}>
                            {findSimilarTeams(selectedMatch.client).map(
                              (team) => (
                                <button
                                  key={team.id}
                                  className={styles.similarTeamBtn}
                                  onClick={() => setClientTeam(team.name)}
                                >
                                  {team.name}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedMatch.players?.client && (
                    <div className={styles.playerInfo}>
                      <p className={styles.playerName}>
                        {selectedMatch.players.client.firstName}{' '}
                        {selectedMatch.players.client.lastName}
                      </p>
                      {selectedMatch.players.client.UTR && (
                        <p className={styles.playerUTR}>
                          UTR: {selectedMatch.players.client.UTR}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className={styles.teamDisplay}>
                  <h4>Opponent Team</h4>
                  {findTeamLogo(selectedMatch.opponent) && (
                    <div className={styles.logoContainer}>
                      <Image
                        src={findTeamLogo(selectedMatch.opponent)}
                        alt={selectedMatch.opponent}
                        width={100}
                        height={100}
                      />
                    </div>
                  )}
                  {selectedMatch.opponent ? (
                    <p className={styles.teamNameDisplay}>
                      {selectedMatch.opponent}
                    </p>
                  ) : (
                    <p className={styles.missingTeam}>Unknown team</p>
                  )}

                  {/* Show suggestion if team is unknown */}
                  {(!selectedMatch.opponent ||
                    !teams.some((t) => t.name === selectedMatch.opponent)) && (
                    <div className={styles.teamSuggestion}>
                      <p>
                        Suggested:{' '}
                        {getSuggestedTeam(selectedMatch.opponent, false)}
                      </p>
                      <button
                        className={styles.applySuggestion}
                        onClick={() =>
                          setOpponentTeam(
                            getSuggestedTeam(selectedMatch.opponent, false)
                          )
                        }
                      >
                        Apply Suggestion
                      </button>

                      {/* Similar team suggestions */}
                      {selectedMatch.opponent && (
                        <div className={styles.similarTeams}>
                          <p className={styles.similarTitle}>Similar Teams:</p>
                          <div className={styles.suggestionsGrid}>
                            {findSimilarTeams(selectedMatch.opponent).map(
                              (team) => (
                                <button
                                  key={team.id}
                                  className={styles.similarTeamBtn}
                                  onClick={() => setOpponentTeam(team.name)}
                                >
                                  {team.name}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedMatch.players?.opponent && (
                    <div className={styles.playerInfo}>
                      <p className={styles.playerName}>
                        {selectedMatch.players.opponent.firstName}{' '}
                        {selectedMatch.players.opponent.lastName}
                      </p>
                      {selectedMatch.players.opponent.UTR && (
                        <p className={styles.playerUTR}>
                          UTR: {selectedMatch.players.opponent.UTR}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Match Statistics Section */}
              {(selectedMatch.score ||
                (selectedMatch.points && selectedMatch.points.length > 0) ||
                (selectedMatch.pointsJson &&
                  selectedMatch.pointsJson.length > 0)) && (
                <div className={styles.statisticsSection}>
                  <h4>Match Statistics</h4>

                  {selectedMatch.score && (
                    <div className={styles.scoreContainer}>
                      <div className={styles.scoreHeader}>
                        <span>Sets</span>
                      </div>
                      <div className={styles.scoreBody}>
                        <div className={styles.scoreRow}>
                          <span className={styles.scoreTeamName}>
                            {selectedMatch.client ||
                              selectedMatch.teams?.clientTeam ||
                              'Client'}
                          </span>
                          {selectedMatch.score.sets &&
                            selectedMatch.score.sets.map((set, index) => (
                              <span key={index} className={styles.scoreCell}>
                                {set.client}
                              </span>
                            ))}
                          <span className={styles.finalScore}>
                            {selectedMatch.score.finalScore?.client || '-'}
                          </span>
                        </div>
                        <div className={styles.scoreRow}>
                          <span className={styles.scoreTeamName}>
                            {selectedMatch.opponent ||
                              selectedMatch.teams?.opponentTeam ||
                              'Opponent'}
                          </span>
                          {selectedMatch.score.sets &&
                            selectedMatch.score.sets.map((set, index) => (
                              <span key={index} className={styles.scoreCell}>
                                {set.opponent}
                              </span>
                            ))}
                          <span className={styles.finalScore}>
                            {selectedMatch.score.finalScore?.opponent || '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Display statistics from points data if available (UCLA W format) */}
                  {selectedMatch.points &&
                    selectedMatch.points.length > 0 &&
                    !selectedMatch.score && (
                      <div>
                        {/* Extract players from points data */}
                        {(() => {
                          const points = selectedMatch.points
                          const lastPoint = points[points.length - 1]
                          const clientPlayer = lastPoint.player1Name || ''
                          const opponentPlayer = lastPoint.player2Name || ''
                          const clientTeam =
                            lastPoint.clientTeam || selectedMatch.client || ''
                          const opponentTeam =
                            lastPoint.opponentTeam ||
                            selectedMatch.opponent ||
                            ''

                          // Calculate set scores
                          const setScores = {}
                          const finalScores = { client: 0, opponent: 0 }

                          points.forEach((point) => {
                            if (
                              point.setNum &&
                              point.player1GameScore !== undefined &&
                              point.player2GameScore !== undefined
                            ) {
                              const setNum = point.setNum

                              if (!setScores[setNum]) {
                                setScores[setNum] = {
                                  client: 0,
                                  opponent: 0
                                }
                              }

                              // Update with the highest game scores we find
                              if (
                                point.player1GameScore >
                                setScores[setNum].client
                              ) {
                                setScores[setNum].client =
                                  point.player1GameScore
                              }

                              if (
                                point.player2GameScore >
                                setScores[setNum].opponent
                              ) {
                                setScores[setNum].opponent =
                                  point.player2GameScore
                              }
                            }
                          })

                          // Convert to array
                          const setsArray = Object.keys(setScores).map(
                            (setNum) => ({
                              client: setScores[setNum].client,
                              opponent: setScores[setNum].opponent
                            })
                          )

                          // Calculate final score (sets won)
                          if (setsArray.length > 0) {
                            setsArray.forEach((set) => {
                              if (set.client > set.opponent)
                                finalScores.client++
                              if (set.opponent > set.client)
                                finalScores.opponent++
                            })
                          }

                          return (
                            <div>
                              <div className={styles.scoreContainer}>
                                <div className={styles.scoreHeader}>
                                  <span>Sets</span>
                                </div>
                                <div className={styles.scoreBody}>
                                  <div className={styles.scoreRow}>
                                    <span className={styles.scoreTeamName}>
                                      {clientTeam} ({clientPlayer})
                                    </span>
                                    {setsArray.map((set, index) => (
                                      <span
                                        key={index}
                                        className={styles.scoreCell}
                                      >
                                        {set.client}
                                      </span>
                                    ))}
                                    <span className={styles.finalScore}>
                                      {finalScores.client}
                                    </span>
                                  </div>
                                  <div className={styles.scoreRow}>
                                    <span className={styles.scoreTeamName}>
                                      {opponentTeam} ({opponentPlayer})
                                    </span>
                                    {setsArray.map((set, index) => (
                                      <span
                                        key={index}
                                        className={styles.scoreCell}
                                      >
                                        {set.opponent}
                                      </span>
                                    ))}
                                    <span className={styles.finalScore}>
                                      {finalScores.opponent}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Generate statistics from points data */}
                              <div className={styles.statsContainer}>
                                <h5>Match Point Statistics</h5>
                                <div className={styles.statsTable}>
                                  {/* Calculate statistics from points data */}
                                  {(() => {
                                    // Calculate aces
                                    const clientAces = points.filter(
                                      (p) =>
                                        p.isAce && p.serverName === clientPlayer
                                    ).length
                                    const opponentAces = points.filter(
                                      (p) =>
                                        p.isAce &&
                                        p.serverName === opponentPlayer
                                    ).length

                                    // Calculate double faults
                                    const clientDoubleFaults = points.filter(
                                      (p) =>
                                        p.serveResult === 'Double Fault' &&
                                        p.serverName === clientPlayer
                                    ).length
                                    const opponentDoubleFaults = points.filter(
                                      (p) =>
                                        p.serveResult === 'Double Fault' &&
                                        p.serverName === opponentPlayer
                                    ).length

                                    // Calculate first serve percentage
                                    const clientFirstServes = points.filter(
                                      (p) =>
                                        p.serverName === clientPlayer &&
                                        p.firstServeIn !== undefined
                                    ).length
                                    const clientFirstServesIn = points.filter(
                                      (p) =>
                                        p.serverName === clientPlayer &&
                                        p.firstServeIn === 1
                                    ).length

                                    const opponentFirstServes = points.filter(
                                      (p) =>
                                        p.serverName === opponentPlayer &&
                                        p.firstServeIn !== undefined
                                    ).length
                                    const opponentFirstServesIn = points.filter(
                                      (p) =>
                                        p.serverName === opponentPlayer &&
                                        p.firstServeIn === 1
                                    ).length

                                    const clientFirstServePercentage =
                                      clientFirstServes > 0
                                        ? Math.round(
                                            (clientFirstServesIn /
                                              clientFirstServes) *
                                              100
                                          )
                                        : 0

                                    const opponentFirstServePercentage =
                                      opponentFirstServes > 0
                                        ? Math.round(
                                            (opponentFirstServesIn /
                                              opponentFirstServes) *
                                              100
                                          )
                                        : 0

                                    // Calculate points won
                                    const clientPointsWon = points.filter(
                                      (p) => p.pointWonBy === clientPlayer
                                    ).length
                                    const opponentPointsWon = points.filter(
                                      (p) => p.pointWonBy === opponentPlayer
                                    ).length

                                    // Return the stats UI
                                    return (
                                      <>
                                        <div className={styles.statsRow}>
                                          <span className={styles.statLabel}>
                                            Points Won
                                          </span>
                                          <span className={styles.statValue}>
                                            {clientPointsWon}
                                          </span>
                                          <span className={styles.statValue}>
                                            {opponentPointsWon}
                                          </span>
                                        </div>
                                        <div className={styles.statsRow}>
                                          <span className={styles.statLabel}>
                                            Aces
                                          </span>
                                          <span className={styles.statValue}>
                                            {clientAces}
                                          </span>
                                          <span className={styles.statValue}>
                                            {opponentAces}
                                          </span>
                                        </div>
                                        <div className={styles.statsRow}>
                                          <span className={styles.statLabel}>
                                            Double Faults
                                          </span>
                                          <span className={styles.statValue}>
                                            {clientDoubleFaults}
                                          </span>
                                          <span className={styles.statValue}>
                                            {opponentDoubleFaults}
                                          </span>
                                        </div>
                                        <div className={styles.statsRow}>
                                          <span className={styles.statLabel}>
                                            First Serve %
                                          </span>
                                          <span className={styles.statValue}>
                                            {clientFirstServePercentage}%
                                          </span>
                                          <span className={styles.statValue}>
                                            {opponentFirstServePercentage}%
                                          </span>
                                        </div>
                                      </>
                                    )
                                  })()}
                                </div>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )}

                  {/* Display statistics from pointsJson data if available (UCLA M format) */}
                  {selectedMatch.pointsJson &&
                    selectedMatch.pointsJson.length > 0 &&
                    !selectedMatch.score && (
                      <div>
                        {/* Extract players from pointsJson data */}
                        {(() => {
                          const points = selectedMatch.pointsJson
                          const clientTeam =
                            selectedMatch.teams?.clientTeam ||
                            selectedMatch.client ||
                            ''
                          const opponentTeam =
                            selectedMatch.teams?.opponentTeam ||
                            selectedMatch.opponent ||
                            ''

                          // Find player names
                          const clientPlayers = [
                            ...new Set(
                              points
                                .filter((p) => p.clientTeam && p.player1Name)
                                .map((p) => p.player1Name)
                            )
                          ]
                          const opponentPlayers = [
                            ...new Set(
                              points
                                .filter((p) => p.opponentTeam && p.player2Name)
                                .map((p) => p.player2Name)
                            )
                          ]

                          const clientPlayer =
                            clientPlayers.length > 0 ? clientPlayers[0] : ''
                          const opponentPlayer =
                            opponentPlayers.length > 0 ? opponentPlayers[0] : ''

                          // Calculate set scores
                          const setScores = {}
                          const finalScores = { client: 0, opponent: 0 }

                          points.forEach((point) => {
                            if (
                              point.setNum &&
                              point.player1GameScore !== undefined &&
                              point.player2GameScore !== undefined
                            ) {
                              const setNum = point.setNum

                              if (!setScores[setNum]) {
                                setScores[setNum] = {
                                  client: 0,
                                  opponent: 0
                                }
                              }

                              // Update with the highest game scores we find
                              if (
                                point.player1GameScore >
                                setScores[setNum].client
                              ) {
                                setScores[setNum].client =
                                  point.player1GameScore
                              }

                              if (
                                point.player2GameScore >
                                setScores[setNum].opponent
                              ) {
                                setScores[setNum].opponent =
                                  point.player2GameScore
                              }
                            }
                          })

                          // Convert to array
                          const setsArray = Object.keys(setScores).map(
                            (setNum) => ({
                              client: setScores[setNum].client,
                              opponent: setScores[setNum].opponent
                            })
                          )

                          // Calculate final score (sets won)
                          if (setsArray.length > 0) {
                            setsArray.forEach((set) => {
                              if (set.client > set.opponent)
                                finalScores.client++
                              if (set.opponent > set.client)
                                finalScores.opponent++
                            })
                          }

                          return (
                            <div>
                              <div className={styles.scoreContainer}>
                                <div className={styles.scoreHeader}>
                                  <span>Sets</span>
                                </div>
                                <div className={styles.scoreBody}>
                                  <div className={styles.scoreRow}>
                                    <span className={styles.scoreTeamName}>
                                      {clientTeam}{' '}
                                      {clientPlayer ? `(${clientPlayer})` : ''}
                                    </span>
                                    {setsArray.map((set, index) => (
                                      <span
                                        key={index}
                                        className={styles.scoreCell}
                                      >
                                        {set.client}
                                      </span>
                                    ))}
                                    <span className={styles.finalScore}>
                                      {finalScores.client}
                                    </span>
                                  </div>
                                  <div className={styles.scoreRow}>
                                    <span className={styles.scoreTeamName}>
                                      {opponentTeam}{' '}
                                      {opponentPlayer
                                        ? `(${opponentPlayer})`
                                        : ''}
                                    </span>
                                    {setsArray.map((set, index) => (
                                      <span
                                        key={index}
                                        className={styles.scoreCell}
                                      >
                                        {set.opponent}
                                      </span>
                                    ))}
                                    <span className={styles.finalScore}>
                                      {finalScores.opponent}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Generate statistics from pointsJson data */}
                              <div className={styles.statsContainer}>
                                <h5>Match Point Statistics</h5>
                                <div className={styles.statsTable}>
                                  {/* Calculate statistics from pointsJson data */}
                                  {(() => {
                                    // Calculate aces
                                    const clientAces = points.filter(
                                      (p) =>
                                        p.isAce === true &&
                                        p.serverName === clientPlayer
                                    ).length
                                    const opponentAces = points.filter(
                                      (p) =>
                                        p.isAce === true &&
                                        p.serverName === opponentPlayer
                                    ).length

                                    // Calculate double faults
                                    const clientDoubleFaults = points.filter(
                                      (p) =>
                                        p.serveResult === 'Double Fault' &&
                                        p.player1Name === clientPlayer
                                    ).length
                                    const opponentDoubleFaults = points.filter(
                                      (p) =>
                                        p.serveResult === 'Double Fault' &&
                                        p.player2Name === opponentPlayer
                                    ).length

                                    // Calculate first serve percentage
                                    const clientFirstServes = points.filter(
                                      (p) =>
                                        p.player1Name === clientPlayer &&
                                        p.firstServeIn !== undefined
                                    ).length
                                    const clientFirstServesIn = points.filter(
                                      (p) =>
                                        p.player1Name === clientPlayer &&
                                        p.firstServeIn === 1
                                    ).length

                                    const opponentFirstServes = points.filter(
                                      (p) =>
                                        p.player2Name === opponentPlayer &&
                                        p.firstServeIn !== undefined
                                    ).length
                                    const opponentFirstServesIn = points.filter(
                                      (p) =>
                                        p.player2Name === opponentPlayer &&
                                        p.firstServeIn === 1
                                    ).length

                                    const clientFirstServePercentage =
                                      clientFirstServes > 0
                                        ? Math.round(
                                            (clientFirstServesIn /
                                              clientFirstServes) *
                                              100
                                          )
                                        : 0

                                    const opponentFirstServePercentage =
                                      opponentFirstServes > 0
                                        ? Math.round(
                                            (opponentFirstServesIn /
                                              opponentFirstServes) *
                                              100
                                          )
                                        : 0

                                    // Calculate points won
                                    const clientPointsWon = points.filter(
                                      (p) => p.pointWonBy === clientPlayer
                                    ).length
                                    const opponentPointsWon = points.filter(
                                      (p) => p.pointWonBy === opponentPlayer
                                    ).length

                                    // Calculate winners and errors
                                    const clientWinners = points.filter(
                                      (p) =>
                                        p.lastShotResult === 'Winner' &&
                                        p.lastShotHitBy === clientPlayer
                                    ).length
                                    const opponentWinners = points.filter(
                                      (p) =>
                                        p.lastShotResult === 'Winner' &&
                                        p.lastShotHitBy === opponentPlayer
                                    ).length

                                    const clientErrors = points.filter(
                                      (p) =>
                                        p.lastShotResult === 'Error' &&
                                        p.lastShotHitBy === clientPlayer
                                    ).length
                                    const opponentErrors = points.filter(
                                      (p) =>
                                        p.lastShotResult === 'Error' &&
                                        p.lastShotHitBy === opponentPlayer
                                    ).length

                                    // Return the stats UI
                                    return (
                                      <>
                                        <div className={styles.statsRow}>
                                          <span className={styles.statLabel}>
                                            Points Won
                                          </span>
                                          <span className={styles.statValue}>
                                            {clientPointsWon}
                                          </span>
                                          <span className={styles.statValue}>
                                            {opponentPointsWon}
                                          </span>
                                        </div>
                                        <div className={styles.statsRow}>
                                          <span className={styles.statLabel}>
                                            Winners
                                          </span>
                                          <span className={styles.statValue}>
                                            {clientWinners}
                                          </span>
                                          <span className={styles.statValue}>
                                            {opponentWinners}
                                          </span>
                                        </div>
                                        <div className={styles.statsRow}>
                                          <span className={styles.statLabel}>
                                            Unforced Errors
                                          </span>
                                          <span className={styles.statValue}>
                                            {clientErrors}
                                          </span>
                                          <span className={styles.statValue}>
                                            {opponentErrors}
                                          </span>
                                        </div>
                                        <div className={styles.statsRow}>
                                          <span className={styles.statLabel}>
                                            Aces
                                          </span>
                                          <span className={styles.statValue}>
                                            {clientAces}
                                          </span>
                                          <span className={styles.statValue}>
                                            {opponentAces}
                                          </span>
                                        </div>
                                        <div className={styles.statsRow}>
                                          <span className={styles.statLabel}>
                                            Double Faults
                                          </span>
                                          <span className={styles.statValue}>
                                            {clientDoubleFaults}
                                          </span>
                                          <span className={styles.statValue}>
                                            {opponentDoubleFaults}
                                          </span>
                                        </div>
                                        <div className={styles.statsRow}>
                                          <span className={styles.statLabel}>
                                            First Serve %
                                          </span>
                                          <span className={styles.statValue}>
                                            {clientFirstServePercentage}%
                                          </span>
                                          <span className={styles.statValue}>
                                            {opponentFirstServePercentage}%
                                          </span>
                                        </div>
                                      </>
                                    )
                                  })()}
                                </div>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )}

                  {selectedMatch.statistics && (
                    <div className={styles.statsContainer}>
                      <h5>Detailed Statistics</h5>
                      <div className={styles.statsTable}>
                        <div className={styles.statsRow}>
                          <span className={styles.statLabel}>Aces</span>
                          <span className={styles.statValue}>
                            {selectedMatch.statistics.client?.aces || '0'}
                          </span>
                          <span className={styles.statValue}>
                            {selectedMatch.statistics.opponent?.aces || '0'}
                          </span>
                        </div>
                        <div className={styles.statsRow}>
                          <span className={styles.statLabel}>
                            Double Faults
                          </span>
                          <span className={styles.statValue}>
                            {selectedMatch.statistics.client?.doubleFaults ||
                              '0'}
                          </span>
                          <span className={styles.statValue}>
                            {selectedMatch.statistics.opponent?.doubleFaults ||
                              '0'}
                          </span>
                        </div>
                        <div className={styles.statsRow}>
                          <span className={styles.statLabel}>
                            First Serve %
                          </span>
                          <span className={styles.statValue}>
                            {selectedMatch.statistics.client
                              ?.firstServePercentage || '0'}
                            %
                          </span>
                          <span className={styles.statValue}>
                            {selectedMatch.statistics.opponent
                              ?.firstServePercentage || '0'}
                            %
                          </span>
                        </div>
                        <div className={styles.statsRow}>
                          <span className={styles.statLabel}>
                            First Serve Points Won
                          </span>
                          <span className={styles.statValue}>
                            {selectedMatch.statistics.client
                              ?.firstServePointsWon || '0'}
                          </span>
                          <span className={styles.statValue}>
                            {selectedMatch.statistics.opponent
                              ?.firstServePointsWon || '0'}
                          </span>
                        </div>
                        <div className={styles.statsRow}>
                          <span className={styles.statLabel}>
                            Second Serve Points Won
                          </span>
                          <span className={styles.statValue}>
                            {selectedMatch.statistics.client
                              ?.secondServePointsWon || '0'}
                          </span>
                          <span className={styles.statValue}>
                            {selectedMatch.statistics.opponent
                              ?.secondServePointsWon || '0'}
                          </span>
                        </div>
                        <div className={styles.statsRow}>
                          <span className={styles.statLabel}>
                            Break Points Saved
                          </span>
                          <span className={styles.statValue}>
                            {selectedMatch.statistics.client
                              ?.breakPointsSaved || '0'}
                          </span>
                          <span className={styles.statValue}>
                            {selectedMatch.statistics.opponent
                              ?.breakPointsSaved || '0'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {!selectedMatch.statistics &&
                    !selectedMatch.points &&
                    !selectedMatch.pointsJson &&
                    selectedMatch.score && (
                      <div className={styles.noStatsMessage}>
                        <p>
                          Detailed statistics for this match are not available.
                        </p>
                      </div>
                    )}
                </div>
              )}

              <div className={styles.matchInfo}>
                <p>
                  <strong>Date:</strong>{' '}
                  {formatDate(selectedMatch.date || selectedMatch.matchDate)}
                </p>
                <p>
                  <strong>Collection:</strong> {selectedMatch.collection}
                </p>

                {selectedMatch.matchDetails && (
                  <div className={styles.additionalInfo}>
                    {selectedMatch.matchDetails.event && (
                      <p>
                        <strong>Event:</strong>{' '}
                        {selectedMatch.matchDetails.event}
                      </p>
                    )}
                    {selectedMatch.matchDetails.division && (
                      <p>
                        <strong>Division:</strong>{' '}
                        {selectedMatch.matchDetails.division}
                      </p>
                    )}
                    {selectedMatch.matchDetails.round && (
                      <p>
                        <strong>Round:</strong>{' '}
                        {selectedMatch.matchDetails.round}
                      </p>
                    )}
                    {selectedMatch.matchDetails.surface && (
                      <p>
                        <strong>Surface:</strong>{' '}
                        {selectedMatch.matchDetails.surface}
                      </p>
                    )}
                  </div>
                )}

                <p>
                  <strong>Match ID:</strong> {selectedMatch.id}
                </p>

                <div className={styles.jsonControlContainer}>
                  <button
                    className={styles.jsonToggleButton}
                    onClick={() => setShowRawJson(!showRawJson)}
                  >
                    {showRawJson ? 'Hide Raw JSON' : 'Show Raw JSON'}
                  </button>
                </div>

                {showRawJson && (
                  <div className={styles.rawJsonContainer}>
                    <pre className={styles.jsonDisplay}>
                      {JSON.stringify(selectedMatch, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.assignTeamsSection}>
              <h3>Update Teams</h3>

              <div className={styles.teamSelectContainer}>
                <div className={styles.teamSelectGroup}>
                  <label>Client Team:</label>
                  <select
                    value={clientTeam}
                    onChange={(e) => setClientTeam(e.target.value)}
                    className={styles.teamSelect}
                  >
                    <option value="">Select a team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.name}>
                        {team.name}
                      </option>
                    ))}
                  </select>

                  {findTeamLogo(clientTeam) && (
                    <div className={styles.selectedLogoContainer}>
                      <Image
                        src={findTeamLogo(clientTeam)}
                        alt={clientTeam}
                        width={60}
                        height={60}
                      />
                    </div>
                  )}
                </div>

                <div className={styles.teamSelectGroup}>
                  <label>Opponent Team:</label>
                  <select
                    value={opponentTeam}
                    onChange={(e) => setOpponentTeam(e.target.value)}
                    className={styles.teamSelect}
                  >
                    <option value="">Select a team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.name}>
                        {team.name}
                      </option>
                    ))}
                  </select>

                  {findTeamLogo(opponentTeam) && (
                    <div className={styles.selectedLogoContainer}>
                      <Image
                        src={findTeamLogo(opponentTeam)}
                        alt={opponentTeam}
                        width={60}
                        height={60}
                      />
                    </div>
                  )}
                </div>
              </div>

              <button
                className={styles.updateButton}
                onClick={handleUpdateMatch}
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update Match Teams'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
