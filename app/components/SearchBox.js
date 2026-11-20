'use client'
import React, { useEffect, useMemo, useState } from 'react'
import styles from '@/app/styles/Navbar.module.css'
import SearchIcon from '@/public/search'
import { useData } from '@/app/DataProvider'

const SearchBox = React.memo(({ searchTerm, onSubmit, onClear }) => {
  const { matches } = useData()
  const [draft, setDraft] = useState(searchTerm)
  const [isFocused, setIsFocused] = useState(false)

  const suggestions = useMemo(() => {
    const values = []
    const seen = new Set()

    const addSuggestion = (type, value) => {
      const cleanValue = typeof value === 'string' ? value.trim() : ''
      if (!cleanValue || seen.has(cleanValue.toLowerCase())) return
      seen.add(cleanValue.toLowerCase())
      values.push({ type, value: cleanValue })
    }

    matches.forEach((match) => {
      addSuggestion(
        'Player',
        `${match.players?.client?.firstName || ''} ${match.players?.client?.lastName || ''}`
      )
      addSuggestion(
        'Player',
        `${match.players?.opponent?.firstName || ''} ${match.players?.opponent?.lastName || ''}`
      )
      addSuggestion('Team', match.teams?.clientTeam)
      addSuggestion('Team', match.teams?.opponentTeam)
      addSuggestion('Event', match.matchDetails?.event)
      addSuggestion('Date', match.matchDate)
    })

    const query = draft.trim().toLowerCase()
    if (!query) return []

    return values
      .filter(({ value }) => value.toLowerCase().includes(query))
      .sort(
        (a, b) =>
          Number(b.value.toLowerCase().startsWith(query)) -
          Number(a.value.toLowerCase().startsWith(query))
      )
      .slice(0, 6)
  }, [draft, matches])

  // Keep the input in sync when a search is submitted or cleared elsewhere.
  useEffect(() => {
    setDraft(searchTerm)
  }, [searchTerm])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      setIsFocused(false)
      onSubmit(draft)
    }
  }

  const handleClear = () => {
    setDraft('')
    setIsFocused(false)
    onClear()
  }

  const handleSuggestionClick = (value) => {
    setDraft(value)
    setIsFocused(false)
    onSubmit(value)
  }

  return (
    <div
      className={styles.searchContainer}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setIsFocused(false)
      }}
    >
      <div className={styles.clearContainer}>
        <div className={styles.searchWrapper}>
          {!draft && <SearchIcon className={styles.searchIcon} />}
          <input
            type="text"
            value={draft}
            placeholder="Search matches, players, or teams"
            className={styles.searchInput}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
          />
        </div>
        {searchTerm && (
          <button
            className={styles.clearButton}
            onClick={handleClear}
            type="button"
          >
            Clear
          </button>
        )}
      </div>
      {isFocused && suggestions.length > 0 && (
        <div
          className={styles.searchSuggestions}
          role="group"
          aria-label="Search suggestions"
        >
          {suggestions.map(({ type, value }) => (
            <button
              key={`${type}-${value}`}
              className={styles.suggestionButton}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSuggestionClick(value)}
              type="button"
              title={`Search for ${value}`}
              aria-label={`Search for ${value}`}
            >
              <span className={styles.suggestionType}>{type}</span>
              <span>{value}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

SearchBox.displayName = 'SearchBox'

export default SearchBox
