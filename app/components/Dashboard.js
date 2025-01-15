'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Fuse from 'fuse.js'

import { useData } from '@/app/DataProvider'
import styles from '@/app/styles/Dashboard.module.css'

import DashTileContainer from '@/app/components/DashTileContainer'
// import getTeams from '@/app/services/getTeams.js'
import RosterList from '@/app/components/RosterList.js'
import Loading from './Loading'

import { searchableProperties } from '@/app/services/searchableProperties.js'
import SearchIcon from '@/public/search'

const formatMatches = (matches) => {
  return matches
    .filter((match) => match.version === 'v1') // Filter for version 'v1'
    .sort((a, b) => new Date(b.matchDate) - new Date(a.matchDate)) // Sort by matchDate in descending order
}

const Dashboard = () => {
  const router = useRouter()
  const { matches, logos } = useData()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMatchSets, setSelectedMatchSets] = useState([])

  console.log('matches', matches)
  console.log(matches.length)
  const formattedMatches = formatMatches(matches)
  console.log(formattedMatches)

  // Fuzzy search
  const fuse = useMemo(() => {
    if (!formattedMatches.length) return null
    return new Fuse(formattedMatches, {
      keys: searchableProperties,
      threshold: 0.3
    })
  }, [formattedMatches])

  const filteredMatchSets = useMemo(() => {
    if (!searchTerm || !fuse) return []
    const result = fuse.search(searchTerm).map((result) => {
      const match = result.item
      return `${match.matchDate}#${match.teams.opponentTeam}`
    })
    return result
  }, [searchTerm, fuse])

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

  // A: Search Results
  // B: Carousel Results
  // Default: All
  const displayMatchSets = useMemo(() => {
    if (searchTerm) return filteredMatchSets
    if (selectedMatchSets.length > 0) return selectedMatchSets

    // fetch all, arr(set(matches))
    return [
      ...new Set(
        formattedMatches.map((match) =>
          match.matchDetails.duel
            ? `${match.matchDate}#${match.teams.opponentTeam}`
            : `_#${match.matchDetails.event}`
        )
      )
    ]
  }, [searchTerm, filteredMatchSets, selectedMatchSets, formattedMatches])

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

      <div className={styles.carousel}>
        {formattedMatches.map((match, index) => {
          let matchKey = `${match.matchDate}#${match.teams.opponentTeam}`
          if (!match.matchDetails.duel) {
            console.log('EVENT')
            matchKey = `_#${match.matchDetails.event}`
          }

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
          {matches.length === 0 ? (
            <Loading prompt={'Fetching Matches...'} />
          ) : (
            displayMatchSets.map((matchKey, index) => {
              const singlesMatches = formattedMatches.filter(
                (match) =>
                  match.singles &&
                  ((match.matchDetails.duel &&
                    matchKey ===
                      `${match.matchDate}#${match.teams.opponentTeam}`) ||
                    (!match.matchDetails.duel &&
                      matchKey === `_#${match.matchDetails.event}`))
              )
              const doublesMatches = formattedMatches.filter(
                (match) =>
                  !match.singles &&
                  ((match.matchDetails.duel &&
                    matchKey ===
                      `${match.matchDate}#${match.teams.opponentTeam}`) ||
                    (!match.matchDetails.duel &&
                      matchKey === `_#${match.matchDetails.event}`))
              )
              const [matchDate, matchName] = matchKey.split('#')

              return (
                <div key={index} className={styles.matchSection}>
                  <div className={styles.matchContainer}>
                    <div className={styles.matchHeader}>
                      <h3>{matchName}</h3>
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
          {<RosterList />}
          {/* <p>Roster being fixed ...</p> */}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
