'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
// import { useMatchData } from './MatchDataProvider'
import { useDatabase } from './DatabaseProvider'
import styles from '../styles/Dashboard.module.css'
import DashTileContainer from './DashTileContainer'
// import getTeams from '@/app/services/getTeams.js'
import RosterList from './RosterList.js'
import Fuse from 'fuse.js'
import { searchableProperties } from '@/app/services/searchableProperties.js'
import SearchIcon from '@/public/search'
// Import sample data to test data fetching
import matchData from '../(interactive)/dashboard/sampleData'

//Import useAuth for Sign Out Button
import { useAuth } from './AuthWrapper'


// Extract date from match name
const extractDateFromName = (name) => {
  const dateRegex = /(\d{1,2})\/(\d{1,2})\/(\d{2})/
  const matchResult = name.match(dateRegex)

  if (!matchResult) return null

  const [month, day, year] = matchResult.slice(1).map(Number)
  const fullYear = year < 50 ? 2000 + year : 1900 + year

  return new Date(fullYear, month - 1, day)
}

// Format date based on type
export const formatDate = (date, formatType) => {
  const month = String(date.getMonth() + 1)
  const day = String(date.getDate())
  const year = date.getFullYear()

  switch (formatType) {
    case 'M/D/YY':
      return `${month}/${day}/${String(year).slice(-2)}`
    case 'M/D/YYYY':
      return `${month}/${day}/${year}`
    case 'MM/DD/YY':
      return `${month.padStart(2, '0')}/${day}/${String(year).slice(-2)}`
    case 'MM/DD/YYYY':
      return `${month.padStart(2, '0')}/${day}/${year}`
    default:
      throw new Error(`Unknown format type: ${formatType}`)
  }
}

// Format matches in order of recency
const formatMatches = (matches) =>
  matches
    .filter((match) => match.clientPlayer && match.opponentPlayer)
    .map((match) => {
      const date = extractDateFromName(match.date)
      return {
        ...match,
        date,
        formattedDate: date ? formatDate(date, 'MM/DD/YYYY') : null
      }
    })
    .sort((a, b) => (b.date && a.date ? b.date - a.date : 1))

// Group matches with the same client and opponent team
const groupMatchesByTeams = (matches) => {
  return matches.reduce((acc, match) => {
    const key = `${match.clientTeam} vs ${match.opponentTeam}`
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(match)
    return acc
  }, {})
}

const Dashboard = () => {
  // const { matches, error } = useMatchData(); // Using the custom hook to access match data
  const matches = matchData // using hardcoded JSON objects
  const router = useRouter()
  const formattedMatches = formatMatches(matchData)
  const { logos } = useDatabase()
  const [searchTerm, setSearchTerm] = useState('')
  const { authUser, userProfile, handleSignOut } = useAuth()

  // Group matches by date
  const matchesByDate = formattedMatches.reduce((acc, match) => {
    const matchDate = match.formattedDate
    if (matchDate && !acc[matchDate]) {
      acc[matchDate] = []
    }
    if (matchDate) {
      acc[matchDate].push(match)
    }
    return acc
  }, {})

  // Function to find the closest past date to today
  const getMostRecentMatch = () => {
    const today = new Date()
    const pastDates = Object.keys(matchesByDate)
      .map((date) => new Date(date))
      .filter((date) => date <= today)
      .sort((a, b) => today - a)

    return pastDates.length > 0 ? formatDate(pastDates[0], 'MM/DD/YYYY') : null
  }

  // State to manage which dates' matches are being shown
  const [selectedDates, setSelectedDates] = useState([])

  useEffect(() => {
    const closestDate = getMostRecentMatch()
    if (closestDate) {
      setSelectedDates([closestDate])
    }
  }, [])

  // Ensure that selected matches are sorted by recency after every selection
  const sortedSelectedDates = [...selectedDates].sort(
    (a, b) => new Date(b) - new Date(a)
  )

  const handleTileClick = (videoId) => {
    router.push(`/matches/${videoId}`)
  }

  // Fuzzy search
  const fuse = new Fuse(formattedMatches, {
    keys: searchableProperties,
    threshold: 0.3
  })

  const filteredMatches = useMemo(() => {
    if (!searchTerm) return []
    const result = fuse.search(searchTerm).map((result) => result.item)
    return groupMatchesByTeams(result)
  }, [searchTerm, fuse])

  const handleSearch = (inputValue) => {
    setSearchTerm(inputValue)
  }

  const handleClearSearch = () => {
    setSearchTerm('')
  }

  const handleCarouselClick = (date) => {
    setSelectedDates((prevDates) =>
      prevDates.includes(date)
        ? prevDates.filter((d) => d !== date)
        : [...prevDates, date]
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleBar}>
          <h1>BSA | Tennis Consulting</h1>
          <div className={styles.buttonBox}>
          <button onClick={handleSignOut}>Sign Out</button>
          </div>
        </div>
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
      <div className={styles.carousel}>
        {Object.keys(matchesByDate).map((date, index) => (
          <div
            key={index}
            className={`${styles.card} ${selectedDates.includes(date) ? styles.active : ''}`}
            onClick={() => handleCarouselClick(date)}
          >
            <div className={styles.cardContent}>
              <img
                src={logos[matchesByDate[date][0].opponentTeam]}
                alt="Team Logo"
                className={styles.logo}
              />
              <span className={styles.matchDate}>
                {formatDate(new Date(date), 'M/D/YY')}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.mainContent}>
        <div className={styles.matchesSection}>
          {/* TODO: Tony integrate filter/cache changes with new search
          take out filler console logs which were used for linting */}
          {console.log(matches, sortedSelectedDates)}
          {searchTerm ? (
            // Render filtered matches grouped by teams
            Object.keys(filteredMatches).length > 0 ? (
              Object.keys(filteredMatches).map((teamKey, index) => {
                const teamMatches = filteredMatches[teamKey]
                const singlesMatches = teamMatches.filter(
                  (match) => match.singlesDoubles === 'Singles'
                )
                const doublesMatches = teamMatches.filter(
                  (match) => match.singlesDoubles === 'Doubles'
                )

                return (
                  <div key={index} className={styles.matchSection}>
                    <div className={styles.matchContainer}>
                      <div className={styles.matchHeader}>
                        <h3>{teamKey}</h3>
                        <span className={styles.date}>
                          {teamMatches[0].formattedDate}
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
            ) : (
              <div className={styles.noMatches}>
                <p>No matches found.</p>
              </div>
            )
          ) : (
            // Original rendering logic for non-searched matches
            Object.keys(matchesByDate).map((date, index) => {
              const singlesMatches = matchesByDate[date].filter(
                (match) => match.singlesDoubles === 'Singles'
              )
              const doublesMatches = matchesByDate[date].filter(
                (match) => match.singlesDoubles === 'Doubles'
              )

              return (
                <div key={index} className={styles.matchSection}>
                  <div className={styles.matchContainer}>
                    <div className={styles.matchHeader}>
                      <h3>{`${matchesByDate[date][0].clientTeam} vs ${matchesByDate[date][0].opponentTeam}`}</h3>
                      <span className={styles.date}>
                        {formatDate(new Date(date), 'M/D/YYYY')}
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
    </div>
  )
}

export default Dashboard
