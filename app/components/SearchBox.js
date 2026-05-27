'use client'
import React, { useEffect, useRef } from 'react'
import styles from '@/app/styles/Navbar.module.css'
import SearchIcon from '@/public/search'

const SearchBox = React.memo(({ searchTerm, onSubmit, onClear }) => {
  const inputRef = useRef(null)

  // Sync input value with searchTerm from context
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = searchTerm
    }
  }, [searchTerm])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const value = inputRef.current?.value || ''
      onSubmit(value)
    }
  }

  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.value = ''
    }
    onClear()
  }

  return (
    <div className={styles.searchContainer}>
      <div className={styles.clearContainer}>
        <div className={styles.searchWrapper}>
          {searchTerm.length === 0 && (
            <SearchIcon className={styles.searchIcon} />
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder="Search"
            className={styles.searchInput}
            onKeyDown={handleKeyDown}
          />
        </div>
        {searchTerm && (
          <button className={styles.clearButton} onClick={handleClear}>
            Clear
          </button>
        )}
      </div>
    </div>
  )
})

SearchBox.displayName = 'SearchBox'

export default SearchBox
