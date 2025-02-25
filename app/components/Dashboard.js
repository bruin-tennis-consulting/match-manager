'use client'

import React, { useState, useMemo } from 'react'
import Image from 'next/image'
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

const cleanTeamName = (teamName) => {
  return teamName.replace(/\s*\([MmWw]\)\s*$/, '').trim() // Remove (M) or (W) from team names
}

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

  const formattedMatches = formatMatches(matches)

  // Fuzzy search
  const fuse = useMemo(() => {
    if (!formattedMatches.length) return null
    return new Fuse(formattedMatches, {
      keys: searchableProperties,
      threshold: 0.4
    })
  }, [formattedMatches])

  const filteredMatchSets = useMemo(() => {
    if (!searchTerm || !fuse) return []
    const result = fuse.search(searchTerm).map((result) => {
      const match = result.item
      const cleanedOpponentTeam = cleanTeamName(match.teams.opponentTeam)
      return `${match.matchDate}#${cleanedOpponentTeam}`
    })
    // Remove duplicates
    return [...new Set(result)]
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
        formattedMatches.map((match) => {
          const cleanedOpponentTeam = cleanTeamName(match.teams.opponentTeam)
          return match.matchDetails.duel
            ? `${match.matchDate}#${cleanedOpponentTeam}`
            : `_#${match.matchDetails.event}`
        })
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
        {console.log(formattedMatches)}
        {(() => {
          const uniqueKeys = new Set() // Track unique match keys
          return (
            formattedMatches
              // keep unique matchKeys
              // note: [...new Set(formattedMatches)] won't work because formattedMatches is an Object
              .filter((match) => {
                const cleanedOpponentTeam = cleanTeamName(
                  match.teams.opponentTeam
                )
                let matchKey = `${match.matchDate}#${cleanedOpponentTeam}`
                if (!match.matchDetails.duel)
                  matchKey = `_#${match.matchDetails.event}`

                if (uniqueKeys.has(matchKey)) return false
                uniqueKeys.add(matchKey)
                return true
              })
              .map((match, index) => {
                const cleanedOpponentTeam = cleanTeamName(
                  match.teams.opponentTeam
                )
                let matchKey = `${match.matchDate}#${cleanedOpponentTeam}`
                if (!match.matchDetails.duel) {
                  matchKey = `_#${match.matchDetails.event}`
                }

                return (
                  <div
                    key={index}
                    className={`${styles.card} ${selectedMatchSets.includes(matchKey) ? styles.active : ''}`}
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
              })
          )
        })()}
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
                      `${match.matchDate}#${cleanTeamName(match.teams.opponentTeam)}`) ||
                    (!match.matchDetails.duel &&
                      (matchKey === `_#${match.matchDetails.event}` ||
                        matchKey ===
                          `${match.matchDate}#${match.teams.opponentTeam}`)))
              )

              const doublesMatches = formattedMatches.filter(
                (match) =>
                  !match.singles &&
                  ((match.matchDetails.duel &&
                    matchKey ===
                      `${match.matchDate}#${cleanTeamName(match.teams.opponentTeam)}`) ||
                    (!match.matchDetails.duel &&
                      (matchKey === `_#${match.matchDetails.event}` ||
                        matchKey ===
                          `${match.matchDate}#${match.teams.opponentTeam}`)))
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
          {<RosterList />}
          {/* <p>Roster being fixed ...</p> */}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
