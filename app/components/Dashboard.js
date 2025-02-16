// Dashboard.jsx
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Fuse from 'fuse.js'

import { useData } from '@/app/DataProvider'
import styles from '@/app/styles/Dashboard.module.css'

import DashTileContainer from '@/app/components/DashTileContainer'
import RosterList from '@/app/components/RosterList.js'
import Loading from './Loading'

import { searchableProperties } from '@/app/services/searchableProperties.js'
import SearchIcon from '@/public/search'

import {
  aggregateTennisStats,
  exportStatsToCSV
} from '../services/Aggregatescript'

const cleanTeamName = (teamName) => {
  return teamName.replace(/\s*\([MmWw]\)\s*$/, '').trim()
}

const formatMatches = (matches) => {
  return matches
    .filter((match) => match.version === 'v1')
    .sort((a, b) => new Date(b.matchDate) - new Date(a.matchDate))
}

const Dashboard = () => {
  const router = useRouter()
  const { matches, logos } = useData()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMatchSets, setSelectedMatchSets] = useState([])
  const [aggregatedStats, setAggregatedStats] = useState(null)

  // Format the matches array.
  const formattedMatches = useMemo(() => formatMatches(matches), [matches])

  console.log(formattedMatches)

  // Setup Fuse.js for fuzzy search.
  const fuse = useMemo(() => {
    if (!formattedMatches.length) return null
    return new Fuse(formattedMatches, {
      keys: searchableProperties,
      threshold: 0.3
    })
  }, [formattedMatches])

  // Create filtered match sets based on the search term.
  const filteredMatchSets = useMemo(() => {
    if (!searchTerm || !fuse) return []
    return fuse.search(searchTerm).map((result) => {
      const match = result.item
      const cleanedOpponentTeam = cleanTeamName(match.teams.opponentTeam)
      return `${match.matchDate}#${cleanedOpponentTeam}`
    })
  }, [searchTerm, fuse])

  // Determine which match sets to display.
  const displayMatchSets = useMemo(() => {
    if (searchTerm) return filteredMatchSets
    if (selectedMatchSets.length > 0) return selectedMatchSets
    return [
      ...new Set(
        formattedMatches.map((match) => {
          const cleanedOpponentTeam = cleanTeamName(match.teams.opponentTeam)
          return match.matchDetails.duel
            ? `${match.matchDate}#${cleanedOpponentTeam}`
            : `_#${match.matchDetails.event}`
        })
      )
    ]
  }, [searchTerm, filteredMatchSets, selectedMatchSets, formattedMatches])

  // Once matches are loaded, calculate the aggregated stats.
  useEffect(() => {
    if (formattedMatches.length > 0) {
      // You can pass manual adjustments here if needed.
      const stats = aggregateTennisStats(formattedMatches, {})
      setAggregatedStats(stats)
    }
  }, [formattedMatches])

  const handleTileClick = (videoId) => {
    router.push(`/matches/${videoId}`)
  }

  const handleSearch = (inputValue) => {
    setSearchTerm(inputValue)
  }

  const handleClearSearch = () => {
    setSearchTerm('')
  }

  const handleCarouselClick = (item) => {
    setSelectedMatchSets((prevSelected) =>
      prevSelected.includes(item)
        ? prevSelected.filter((m) => m !== item)
        : [...prevSelected, item]
    )
  }

  // Function to download the aggregated stats as a CSV file.
  const downloadCSV = () => {
    if (!aggregatedStats) return
    const csvData = exportStatsToCSV(aggregatedStats)
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tennis_stats.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h2>Dashboard</h2>
          <div className={styles.searchContainer}>
            <div className={styles.clearContainer}>
              <div className={styles.searchWrapper}>
                {searchTerm.length === 0 && (
                  <SearchIcon className={styles.searchIcon} />
                )}
                <input
                  type="text"
                  placeholder="Search"
                  className={styles.searchInput}
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
              {searchTerm && (
                <button
                  className={styles.clearButton}
                  onClick={handleClearSearch}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Carousel for match selection */}
      <div className={styles.carousel}>
        {formattedMatches.map((match, index) => {
          const cleanedOpponentTeam = cleanTeamName(match.teams.opponentTeam)
          const matchKey = match.matchDetails.duel
            ? `${match.matchDate}#${cleanedOpponentTeam}`
            : `_#${match.matchDetails.event}`
          return (
            <div
              key={index}
              className={`${styles.card} ${
                selectedMatchSets.includes(matchKey) ? styles.active : ''
              }`}
              onClick={() => handleCarouselClick(matchKey)}
            >
              <Image
                src={logos[match.teams.opponentTeam]}
                alt="Team Logo"
                width={50}
                height={50}
                className={styles.logo}
              />
              <span className={styles.matchDate}>{match.matchDate}</span>
            </div>
          )
        })}
      </div>

      {/* Main content: Match tiles and roster */}
      <div className={styles.mainContent}>
        <div className={styles.matchesSection}>
          {matches.length === 0 ? (
            <Loading prompt={'Fetching Matches...'} />
          ) : (
            displayMatchSets.map((matchKey, index) => {
              const singlesMatches = formattedMatches.filter(
                (match) =>
                  match.singles &&
                  ((match.matchDetails.duel &&
                    matchKey ===
                      `${match.matchDate}#${cleanTeamName(
                        match.teams.opponentTeam
                      )}`) ||
                    (!match.matchDetails.duel &&
                      matchKey === `_#${match.matchDetails.event}`))
              )
              const doublesMatches = formattedMatches.filter(
                (match) =>
                  !match.singles &&
                  ((match.matchDetails.duel &&
                    matchKey ===
                      `${match.matchDate}#${cleanTeamName(
                        match.teams.opponentTeam
                      )}`) ||
                    (!match.matchDetails.duel &&
                      matchKey === `_#${match.matchDetails.event}`))
              )
              const [matchDate, matchName] = matchKey.split('#')
              const cleanedMatchName =
                matchName === '_' ? matchName : cleanTeamName(matchName)
              return (
                <div key={index} className={styles.matchSection}>
                  <div className={styles.matchContainer}>
                    <div className={styles.matchHeader}>
                      <h3>{cleanedMatchName}</h3>
                      <span className={styles.date}>
                        {new Date(matchDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <DashTileContainer
                      matches={singlesMatches}
                      matchType="Singles"
                      onTileClick={handleTileClick}
                    />
                    <DashTileContainer
                      matches={doublesMatches}
                      matchType="Doubles"
                      onTileClick={handleTileClick}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className={styles.rosterContainer}>
          <RosterList />
        </div>
      </div>

      {/* Stats Section */}
      <div className={styles.statsSection}>
        <h2>Aggregated Tennis Stats</h2>
        {aggregatedStats ? (
          <div>
            {/* enable this for Json Format */}
            {/* <pre>{JSON.stringify(aggregatedStats, null, 2)}</pre> */}
            <button onClick={downloadCSV}>Download CSV</button>
          </div>
        ) : (
          <p>No stats available.</p>
        )}
      </div>
    </div>
  )
}

export default Dashboard
