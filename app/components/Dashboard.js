'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useMatchData } from './MatchDataProvider'
import { useDatabase } from './DatabaseProvider'
import styles from '../styles/Dashboard.module.css'
import DashTileContainer from './DashTileContainer'
// import getTeams from '@/app/services/getTeams.js'
import RosterList from './RosterList.js'
import Fuse from 'fuse.js'
import { searchableProperties } from '@/app/services/searchableProperties.js'
import SearchIcon from '@/public/search'

const formatMatches = (matches) => {
  return matches
    .filter((match) => match.version === 'v1') // Filter for version 'v1'
    .sort((a, b) => new Date(b.matchDate) - new Date(a.matchDate)) // Sort by matchDate in descending order
}

// Group matches with the same client and opponent team
const groupMatchesByTeams = (matches) => {
  return matches.reduce((acc, match) => {
    const key = `${match.teams.clientTeam} vs ${match.teams.opponentTeam} ${match.matchDate}`
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(match)
    return acc
  }, {})
}

const Dashboard = () => {
  const router = useRouter()
  const { matches, error } = useMatchData() // Using the custom hook to access match data
  const { logos } = useDatabase()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMatchSets, setSelectedMatchSets] = useState([])

  const formattedMatches = formatMatches(matches)

  const handleTileClick = (videoId) => {
    router.push(`/matches/${videoId}`)
  }

  console.log(formattedMatches)
  // Fuzzy search
  const fuse = useMemo(
    () =>
      new Fuse(formattedMatches, {
        keys: searchableProperties,
        threshold: 0.3
      }),
    [formattedMatches]
  )

  const filteredMatches = useMemo(() => {
    if (!searchTerm) return []
    const result = fuse.search(searchTerm).map((result) => result.item)
    console.log(result)
    return groupMatchesByTeams(result)
  }, [searchTerm, fuse])

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

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>BSA | Tennis Consulting</h1>
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
        {formattedMatches.map((match, index) => {
          const matchKey = `${match.matchDate}#${match.teams.opponentTeam}`

          return (
            <div
              key={index}
              className={`${styles.card} ${selectedMatchSets.includes(matchKey) ? styles.active : ''}`}
              onClick={() => handleCarouselClick(matchKey)}
            >
              <img
                src={logos[match.teams.opponentTeam]}
                alt="Team Logo"
                className={styles.logo}
              />
              <span className={styles.matchDate}>{match.matchDate}</span>
            </div>
          )
        })}
      </div>

      <div className={styles.mainContent}>
        <div className={styles.matchesSection}>
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
                          {teamMatches[0].matchDate}
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
            selectedMatchSets.map((matchKey, index) => {
              const singlesMatches = formattedMatches.filter(
                (match) =>
                  match.singles &&
                  matchKey === `${match.matchDate}#${match.teams.opponentTeam}`
              )
              const doublesMatches = formattedMatches.filter(
                (match) =>
                  !match.singles &&
                  matchKey === `${match.matchDate}#${match.teams.opponentTeam}`
              )
              const [matchDate, matchName] = matchKey.split('#')
              return (
                <div key={index} className={styles.matchSection}>
                  <div className={styles.matchContainer}>
                    <div className={styles.matchHeader}>
                      <h3>{`v ${matchName}`}</h3>
                      <span className={styles.date}>{matchDate}</span>
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
