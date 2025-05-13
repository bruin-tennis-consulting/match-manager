'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import Fuse from 'fuse.js'
import { useAuth } from '@/app/AuthWrapper.js'
import { useData } from '@/app/DataProvider'
import '../styles/MatchList.css'
import {
  aggregatePlayerStats,
  exportStatsToCSV
} from '@/app/services/playerAggregateScript.js'
import { downloadCollectionAsZip } from '@/app/services/downloadCollectionAsZip'

import {
  calculateMatchStats,
  exportMatchStatsToCSV
} from '@/app/services/matchStatsScript.js'

const formatMatches = (matches) => {
  return matches
    .filter((match) => match.version === 'v1') // Filter for version 'v1'
    .sort((a, b) => new Date(b.matchDate) - new Date(a.matchDate)) // Sort by matchDate in descending order
}

export default function MatchList() {
  const { userProfile } = useAuth()
  const { matches, updateMatch, refresh } = useData()
  const [playerStatsProgress, setPlayerStatsProgress] = useState(0)
  const [matchStatsProgress, setMatchStatsProgress] = useState(0)
  const [collectionProgress, setCollectionProgress] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')

  const formattedMatches = formatMatches(matches)

  // Generate match names for search
  const matchesWithNames = useMemo(() => {
    return formattedMatches.map((match) => {
      const matchName = `${match.players.client.firstName} ${match.players.client.lastName} ${match.teams.clientTeam} vs. ${match.players.opponent.firstName} ${match.players.opponent.lastName} ${match.teams.opponentTeam}`
      return { ...match, matchName }
    })
  }, [formattedMatches])

  // Setup Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    if (!matchesWithNames.length) return null
    return new Fuse(matchesWithNames, {
      keys: ['matchName'],
      threshold: 0.3,
      includeScore: true
    })
  }, [matchesWithNames])

  // Filter matches based on search term
  const filteredMatches = useMemo(() => {
    if (!searchTerm || !fuse) return matchesWithNames
    return fuse.search(searchTerm).map((result) => result.item)
  }, [searchTerm, fuse, matchesWithNames])

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this match?')) {
      try {
        await updateMatch(id, { _deleted: true }) // Mark the match as deleted
        refresh() // Refresh match data after deletion
      } catch (error) {
        console.error('Error deleting match:', error)
      }
    }
  }

  const handleDownload = (points, matchId) => {
    const jsonString = JSON.stringify(points, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${matchId}_points.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadPlayerStats = () => {
    let progress = 0
    const interval = setInterval(() => {
      progress += 10
      setPlayerStatsProgress(progress)
      if (progress >= 100) {
        clearInterval(interval)
        const aggregated = aggregatePlayerStats(matches)
        const csv = exportStatsToCSV(aggregated)
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'player_stats.csv'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setPlayerStatsProgress(0)
      }
    }, 300)
  }

  const handleDownloadMatchStats = () => {
    let progress = 0
    const interval = setInterval(() => {
      progress += 10
      setMatchStatsProgress(progress)
      if (progress >= 100) {
        clearInterval(interval)
        const stats = calculateMatchStats(matches)
        const csv = exportMatchStatsToCSV(stats)
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'match_stats.csv'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setMatchStatsProgress(0)
      }
    }, 300)
  }

  const handleDownloadCollectionAsZip = () => {
    if (
      !userProfile ||
      !userProfile.collections ||
      userProfile.collections.length === 0
    ) {
      return
    }

    const collectionName = userProfile.collections[0]
    let progress = 0

    const interval = setInterval(() => {
      progress += 10
      setCollectionProgress(progress)
      if (progress >= 100) {
        clearInterval(interval)
        downloadCollectionAsZip(collectionName).finally(() => {
          setCollectionProgress(0)
        })
      }
    }, 300)
  }

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value)
  }

  return (
    <div className="match-list-container">
      <div className="list-header">
        <h1 className="list-title">Match List</h1>
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search matches..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {filteredMatches.length > 0 ? (
        <div className="match-list">
          {filteredMatches.map((match) => (
            <div key={match.id} className="match-item">
              <div className="match-header">
                <div className="match-name">{match.matchName}</div>
                <div className="match-id">[{match.id}]</div>
              </div>

              <div className="match-actions">
                <div className="action-group">
                  <Link href={`/tag-match/${match.id}`}>
                    <button className="action-btn primary">
                      Tag Match - Full
                    </button>
                  </Link>
                  <Link href={`/timestamp-tagger?videoId=${match.videoId}`}>
                    <button className="action-btn primary">
                      Tag Match - Timestamp
                    </button>
                  </Link>
                  <Link
                    href={`/simple-tagger?videoId=${match.videoId}&matchId=${match.id}`}
                  >
                    <button className="action-btn primary">
                      Tag Match - Simple
                    </button>
                  </Link>
                </div>

                <div className="action-group">
                  <button
                    className="action-btn secondary"
                    onClick={() => handleDownload(match.pointsJson, match.id)}
                  >
                    Download JSON
                  </button>
                  <button
                    className="action-btn danger"
                    onClick={() => handleDelete(match.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="loading-message">
          {matches.length === 0 ? (
            <p>Loading matches...</p>
          ) : (
            <p>No matches found. Try a different search term.</p>
          )}
        </div>
      )}

      <div className="stats-actions">
        <div className="stats-download-container">
          <button className="download-btn" onClick={handleDownloadPlayerStats}>
            Download Player Stats
          </button>
          {playerStatsProgress > 0 && (
            <progress
              value={playerStatsProgress}
              max="100"
              className="download-progress"
            />
          )}
        </div>

        <div className="stats-download-container">
          <button className="download-btn" onClick={handleDownloadMatchStats}>
            Download Match Stats
          </button>
          {matchStatsProgress > 0 && (
            <progress
              value={matchStatsProgress}
              max="100"
              className="download-progress"
            />
          )}
        </div>

        <div className="stats-download-container">
          <button
            className="download-btn"
            onClick={handleDownloadCollectionAsZip}
          >
            Download Collection As Zip
          </button>
          {collectionProgress > 0 && (
            <progress
              value={collectionProgress}
              max="100"
              className="download-progress"
            />
          )}
        </div>
      </div>
    </div>
  )
}
