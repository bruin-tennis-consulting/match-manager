'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Fuse from 'fuse.js'
import debounce from 'lodash/debounce'

import { useData } from '@/app/DataProvider'
import styles from '@/app/styles/Dashboard.module.css'

import DashTileContainer from '@/app/components/DashTileContainer'
import RosterList from '@/app/components/RosterList.js'
import Loading from './Loading'

import { searchableProperties } from '@/app/services/searchableProperties.js'
import SearchIcon from '@/public/search'

const cleanTeamName = (teamName) => {
  return teamName.replace(/\s*\([MmWw]\)\s*$/, '').trim()
}

const formatMatches = (matches) => {
  return matches
    .filter((match) => match.version === 'v1')
    .sort((a, b) => new Date(b.matchDate) - new Date(a.matchDate))
}

// Memoized CarouselItem with fixed dimensions but original logo container
const CarouselItem = React.memo(({ match, isSelected, onClick, logo }) => {
  const cleanedOpponentTeam = cleanTeamName(match.teams.opponentTeam)
  const matchKey = match.matchDetails.duel
    ? `${match.matchDate}#${cleanedOpponentTeam}`
    : `_#${match.matchDetails.event}`

  // Use placeholder for image if logo is null/undefined? Currently no placeholder.
  // const imageSrc = logo || ./placeholder.
  const imageSrc = logo

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.active : ''}`}
      onClick={() => onClick(matchKey)}
    >
      <Image
        src={imageSrc}
        loading="lazy"
        alt="Team Logo"
        width={50}
        height={50}
        className={styles.logo}
        // Add blur placeholder for faster perceived loading
        placeholder="blur"
        blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
      />
      <span className={styles.matchDate}>{match.matchDate}</span>
    </div>
  )
})
CarouselItem.displayName = 'CarouselItem'

const SearchBox = React.memo(({ searchTerm, onSearch, onClear }) => {
  const debouncedSearch = useCallback(
    debounce((value) => onSearch(value), 300),
    [onSearch]
  )

  const handleChange = (e) => {
    const value = e.target.value
    debouncedSearch(value)
  }

  return (
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
            defaultValue={searchTerm}
            onChange={handleChange}
          />
        </div>
        {searchTerm && (
          <button className={styles.clearButton} onClick={onClear}>
            Clear
          </button>
        )}
      </div>
    </div>
  )
})

SearchBox.displayName = 'SearchBox'

// MatchSection with placeholder heights
const MatchSection = React.memo(
  ({ matchKey, formattedMatches, onTileClick }) => {
    const singlesMatches = formattedMatches.filter(
      (match) =>
        match.singles &&
        ((match.matchDetails.duel &&
          matchKey ===
            `${match.matchDate}#${cleanTeamName(match.teams.opponentTeam)}`) ||
          (!match.matchDetails.duel &&
            matchKey === `_#${match.matchDetails.event}`))
    )

    const doublesMatches = formattedMatches.filter(
      (match) =>
        !match.singles &&
        ((match.matchDetails.duel &&
          matchKey ===
            `${match.matchDate}#${cleanTeamName(match.teams.opponentTeam)}`) ||
          (!match.matchDetails.duel &&
            matchKey === `_#${match.matchDetails.event}`))
    )

    const [matchName] = matchKey.split('#')
    const displayName =
      matchName === '_'
        ? formattedMatches.find(
            (match) =>
              !match.matchDetails.duel && match.matchDetails.event === matchName
          )?.matchDetails.event || matchName
        : cleanTeamName(matchName)

    const parseLocalDate = (dateString) => {
      const [year, month, day] = dateString.split('-').map(Number)
      return new Date(year, month - 1, day)
    }

    const allDisplayedMatches = [...singlesMatches, ...doublesMatches]
    const dates = allDisplayedMatches
      .map((m) => parseLocalDate(m.matchDate))
      .sort((a, b) => a - b)

    let displayDate = ''
    if (
      dates.length === 1 ||
      dates[0].getTime() === dates[dates.length - 1].getTime()
    ) {
      displayDate = dates[0].toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } else {
      const [startDate, endDate] = [dates[0], dates[dates.length - 1]]
      const sameMonth = startDate.getMonth() === endDate.getMonth()
      const sameYear = startDate.getFullYear() === endDate.getFullYear()

      if (sameMonth && sameYear) {
        displayDate = `${startDate.toLocaleString('en-US', {
          month: 'long'
        })} ${startDate.getDate()}–${endDate.getDate()}, ${startDate.getFullYear()}`
      } else if (sameYear) {
        displayDate = `${startDate.toLocaleString('en-US', {
          month: 'long',
          day: 'numeric'
        })} – ${endDate.toLocaleString('en-US', {
          month: 'long',
          day: 'numeric'
        })}, ${startDate.getFullYear()}`
      } else {
        displayDate = `${startDate.toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })} – ${endDate.toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })}`
      }
    }

    return (
      <div className={styles.matchSection}>
        <div className={styles.matchContainer}>
          <div className={styles.matchHeader}>
            <h3>{displayName}</h3>
            <span className={styles.date}>{displayDate}</span>
          </div>
          <DashTileContainer
            matches={singlesMatches}
            matchType="Singles"
            onTileClick={onTileClick}
          />
          <DashTileContainer
            matches={doublesMatches}
            matchType="Doubles"
            onTileClick={onTileClick}
          />
        </div>
      </div>
    )
  }
)

MatchSection.displayName = 'MatchSection'

// Main Dashboard component
const Dashboard = () => {
  const router = useRouter()
  const { matches, logos } = useData()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMatchSets, setSelectedMatchSets] = useState([])
  const [isMobile, setIsMobile] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const [searchIndex, setSearchIndex] = useState(null)
  // Calculate formatted matches once
  const formattedMatches = useMemo(() => {
    const formatted = matches && matches.length ? formatMatches(matches) : []
    if (formatted.length && !isLoaded) {
      // Mark as loaded once we have data to prevent layout shifts
      setIsLoaded(true)
    }
    return formatted
  }, [matches, isLoaded])

  // Mobile detection useEffect
  useEffect(() => {
    const checkIfMobile = () => setIsMobile(window.innerWidth < 400)
    checkIfMobile()

    const resizeObserver = new ResizeObserver(checkIfMobile)
    resizeObserver.observe(document.body)

    return () => resizeObserver.disconnect()
  }, [])

  // Create search index after component mounts and formattedMatches is available
  useEffect(() => {
    if (formattedMatches.length && !searchIndex) {
      const timer = setTimeout(() => {
        const fuse = new Fuse(formattedMatches, {
          keys: searchableProperties,
          threshold: 0.4
        })
        setSearchIndex(fuse)
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [formattedMatches, searchIndex]) // Now formattedMatches is defined before this useEffect

  // Filtered match sets calculation using the searchIndex from state
  const filteredMatchSets = useMemo(() => {
    if (!searchTerm || !searchIndex) return []

    const uniqueMatchKeys = new Set()
    return searchIndex
      .search(searchTerm)
      .map((result) => {
        const match = result.item

        return match.matchDetails.duel
          ? `${match.matchDate}#${match.teams.opponentTeam}`
          : `_#${match.matchDetails.event}`
      })
      .filter((matchKey) => {
        if (uniqueMatchKeys.has(matchKey)) return false
        uniqueMatchKeys.add(matchKey)
        return true
      })
  }, [searchTerm, searchIndex])

  // displayMatchSets is either:
  // A) filteredMatchSets from the Search, or
  // B) selectedMatchSets from Carousel, or
  // C) default All Matches
  const displayMatchSets = useMemo(() => {
    if (searchTerm) return filteredMatchSets
    if (selectedMatchSets.length > 0) return selectedMatchSets
    return [
      ...new Set(
        formattedMatches.map((match) => {
          return match.matchDetails.duel
            ? `${match.matchDate}#${match.teams.opponentTeam}`
            : `_#${match.matchDetails.event}`
        })
      )
    ]
  }, [searchTerm, filteredMatchSets, selectedMatchSets, formattedMatches])

  const handleTileClick = useCallback(
    (videoId) => {
      router.push(`/matches/${videoId}`)
    },
    [router]
  )

  const handleSearch = useCallback((inputValue) => {
    setSearchTerm(inputValue)
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchTerm('')
  }, [])

  const handleCarouselClick = useCallback((item) => {
    setSelectedMatchSets((prev) =>
      prev.includes(item) ? prev.filter((m) => m !== item) : [...prev, item]
    )
  }, [])

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h2>Dashboard</h2>
          <SearchBox
            searchTerm={searchTerm}
            onSearch={handleSearch}
            onClear={handleClearSearch}
          />
        </div>
      </header>

      <div className={styles.carousel}>
        {!formattedMatches.length
          ? // Placeholder skeletons for carousel items
            Array(10)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className={`${styles.card} ${styles.placeholderCard}`}
                />
              ))
          : // Map over formattedMatches to render each CarouselItem
            formattedMatches.map((match, index) => (
              <CarouselItem
                key={index}
                match={match}
                logo={logos[match.teams.opponentTeam]}
                isSelected={selectedMatchSets.includes(
                  match.matchDetails.duel
                    ? `${match.matchDate}#${cleanTeamName(match.teams.opponentTeam)}`
                    : `_#${match.matchDetails.event}`
                )}
                onClick={handleCarouselClick}
              />
            ))}
      </div>

      <div className={styles.mainContent}>
        <div
          className={styles.matchesSection}
          // Reserve space with min-height to prevent layout shift
          style={{ minHeight: isLoaded ? 'auto' : '400px' }}
        >
          {!isLoaded ? (
            <Loading prompt={'Fetching Matches...'} />
          ) : displayMatchSets.length === 0 ? (
            <div className={styles.noMatches}>No matches found</div>
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

              const matchName = matchKey.split('#')[1]
              const displayName =
                matchName === '_' ? matchName : cleanTeamName(matchName)

              const parseLocalDate = (dateString) => {
                const [year, month, day] = dateString.split('-').map(Number)
                return new Date(year, month - 1, day)
              }

              const allDisplayedMatches = [...singlesMatches, ...doublesMatches]
              const dates = allDisplayedMatches
                .map((m) => parseLocalDate(m.matchDate))
                .sort((a, b) => a - b)

              let displayDate = ''
              if (dates.length === 0) {
                displayDate = 'Date unavailable'
              } else if (
                dates.length === 1 ||
                dates[0].getTime() === dates[dates.length - 1].getTime()
              ) {
                displayDate = dates[0].toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })
              } else {
                const [startDate, endDate] = [dates[0], dates[dates.length - 1]]
                const sameMonth = startDate.getMonth() === endDate.getMonth()
                const sameYear =
                  startDate.getFullYear() === endDate.getFullYear()

                if (sameMonth && sameYear) {
                  displayDate = `${startDate.toLocaleString('en-US', {
                    month: 'long'
                  })} ${startDate.getDate()}–${endDate.getDate()}, ${startDate.getFullYear()}`
                } else if (sameYear) {
                  displayDate = `${startDate.toLocaleString('en-US', {
                    month: 'long',
                    day: 'numeric'
                  })} – ${endDate.toLocaleString('en-US', {
                    month: 'long',
                    day: 'numeric'
                  })}, ${startDate.getFullYear()}`
                } else {
                  displayDate = `${startDate.toLocaleString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })} – ${endDate.toLocaleString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}`
                }
              }

              return (
                <div key={index} className={styles.matchSection}>
                  <div className={styles.matchContainer}>
                    <div className={styles.matchHeader}>
                      <h3>{displayName}</h3>
                      <span className={styles.date}>{displayDate}</span>
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

        <div
          className={styles.rosterContainer}
          style={{ minHeight: !isMobile ? '400px' : '0' }}
        >
          {!isMobile && <RosterList />}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
