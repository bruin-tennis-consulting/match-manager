import React, { useState, useMemo, useEffect } from 'react'
import { filterGroups } from '../services/filterGroups'

const FilterList = ({
  pointsData,
  filterList,
  setFilterList,
  showPercent,
  showCount,
  onSubmitRef,
  player1Name = 'Player 1',
  player2Name = 'Player 2'
}) => {
  const [openSections, setOpenSections] = useState({})
  const [pendingList, setPendingList] = useState(filterList)

  // Sync pendingList when filterList changes (ex. when a filter is removed via X)
  useEffect(() => {
    setPendingList(filterList)
  }, [filterList])
  // Calculate available filters from the actual data
  const availableFilters = useMemo(() => {
    const filters = {}

    pointsData.forEach((point) => {
      Object.entries(point).forEach(([key, value]) => {
        if (!filters[key]) {
          filters[key] = new Set()
        }
        if (value !== null && value !== '') {
          filters[key].add(value)
        }
      })
    })

    return filters
  }, [pointsData])

  // Helper function to check if a category has any available values
  const hasCategoryValues = (category, key) => {
    if (category.type === 'checkbox') {
      return availableFilters[key]?.has('Yes')
    }
    if (category.values) {
      return category.values.some((value) => availableFilters[key]?.has(value))
    }
    return false
  }

  // Helper function to check if a section has any available filters
  const hasSectionFilters = (section) => {
    if (section.subCategories) {
      return Object.entries(section.subCategories).some(([key, category]) =>
        hasCategoryValues(category, key)
      )
    }
    if (section.players) {
      return Object.values(section.players).some((player) =>
        Object.entries(player.categories).some(([key, category]) =>
          hasCategoryValues(category, key)
        )
      )
    }
    return false
  }

  const handleSubmit = () => {
    setFilterList(pendingList)
  }

  useEffect(() => {
    if (onSubmitRef) {
      onSubmitRef.current = handleSubmit
    }
  }, [onSubmitRef, handleSubmit])

  const toggleSection = (path) => {
    setOpenSections((prev) => ({
      ...prev,
      [path]: !prev[path]
    }))
  }

  const isOpen = (path) => openSections[path] || false

  const addFilter = (key, value) => {
    if (
      !pendingList.some(
        ([filterKey, filterValue]) => filterKey === key && filterValue === value
      )
    ) {
      setPendingList([...pendingList, [key, value]])
    }
  }

  const removeFilter = (key, value) => {
    setPendingList(
      pendingList.filter(
        ([filterKey, filterValue]) =>
          !(filterKey === key && filterValue === value)
      )
    )
  }

  const isActiveFilter = (key, value) => {
    return pendingList.some(
      ([filterKey, filterValue]) => filterKey === key && filterValue === value
    )
  }

  const countFilteredPointsForValue = (key, value) => {
    return pointsData.filter((point) => point[key] === value).length
  }

  const countFilteredPointsTotal = (key) => {
    return pointsData.reduce((total, point) => {
      if (point[key] !== '' && point[key] !== null) {
        return total + 1
      }
      return total
    }, 0)
  }

  const renderCategoryValues = (values, key) => {
    const availableValues = values.filter((value) =>
      availableFilters[key]?.has(value)
    )

    if (availableValues.length === 0) return null

    return availableValues.map((value) => (
      <div
        key={`${key}-${value}`}
        style={{
          marginLeft: '2.3vw',
          fontSize: '1.5vw',
          padding: '1vh 0',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <input
          type="checkbox"
          checked={isActiveFilter(key, value)}
          onChange={() => {
            if (isActiveFilter(key, value)) {
              removeFilter(key, value)
            } else {
              addFilter(key, value)
            }
          }}
          style={{ width: '1.5vw', height: '3.6vh', marginRight: '0.8vw' }}
        />
        <span style={{ flex: 1 }}>{value}</span>
        {showPercent && (
          <span style={{ marginLeft: '0.8vw' }}>
            {Math.round(
              (countFilteredPointsForValue(key, value) /
                countFilteredPointsTotal(key)) *
                100
            )}
            %
          </span>
        )}
        {showCount && (
          <span style={{ marginLeft: '0.8vw' }}>
            {countFilteredPointsForValue(key, value)} /{' '}
            {countFilteredPointsTotal(key)}
          </span>
        )}
      </div>
    ))
  }

  const renderCategory = (key, category, path) => {
    if (!hasCategoryValues(category, key)) return null

    if (category.type === 'checkbox') {
      return (
        <div
          key={key}
          style={{
            marginLeft: '2.3vw',
            fontSize: '1.4vw',
            padding: '0.5vw 0',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <input
            type="checkbox"
            checked={isActiveFilter(key, 'Yes')}
            onChange={() => {
              if (isActiveFilter(key, 'Yes')) {
                removeFilter(key, 'Yes')
              } else {
                addFilter(key, 'Yes')
              }
            }}
            style={{ width: '1.5vw', height: '3.6vh', marginRight: '0.8vw' }}
          />
          <span>{category.title}</span>
          {showPercent && (
            <span style={{ marginLeft: '0.8vw' }}>
              {Math.round(
                (countFilteredPointsForValue(key, 'Yes') /
                  countFilteredPointsTotal(key)) *
                  100
              )}
              %
            </span>
          )}
          {showCount && (
            <span style={{ marginLeft: '0.8vw' }}>
              {countFilteredPointsForValue(key, 'Yes')} /{' '}
              {countFilteredPointsTotal(key)}
            </span>
          )}
        </div>
      )
    }

    return (
      <div key={key} style={{ marginLeft: '2.3vw' }}>
        <div
          onClick={() => toggleSection(path)}
          style={{
            cursor: 'pointer',
            fontSize: '1.5vw',
            padding: '0.5vw 0',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <span style={{ marginRight: '0.8vw', width: '1.5vw' }}>
            {isOpen(path) ? '⌄' : '›'}
          </span>
          {category.title}
        </div>
        {isOpen(path) && renderCategoryValues(category.values, key)}
      </div>
    )
  }

  const renderPlayerSection = (playerData, path) => {
    const hasPlayerFilters = Object.entries(playerData.categories).some(
      ([categoryKey, category]) => hasCategoryValues(category, categoryKey)
    )

    if (!hasPlayerFilters) return null

    // Determine which player name to use based on the path
    const displayName = path.includes('player1')
      ? player1Name
      : path.includes('player2')
        ? player2Name
        : playerData.title

    return (
      <div style={{ marginLeft: '2.3vw' }}>
        <div
          onClick={() => toggleSection(path)}
          style={{
            cursor: 'pointer',
            fontSize: '1.7vw',
            padding: '0.5vw 0',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <span style={{ marginRight: '0.8vw', width: '1.5vw' }}>
            {isOpen(path) ? '⌄' : '›'}
          </span>
          {displayName}
        </div>
        {isOpen(path) &&
          Object.entries(playerData.categories).map(([categoryKey, category]) =>
            renderCategory(categoryKey, category, `${path}.${categoryKey}`)
          )}
      </div>
    )
  }

  return (
    <div
      style={{
        fontSize: '1.7vw'
      }}
    >
      {Object.entries(filterGroups).map(([key, group]) => {
        if (!hasSectionFilters(group)) return null

        return (
          <div key={key} style={{ marginBottom: '.7vh' }}>
            <div
              onClick={() => toggleSection(key)}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <span style={{ marginRight: '0.8vw', width: '1.5vw' }}>
                {isOpen(key) ? '⌄' : '›'}
              </span>
              {group.title}
            </div>

            {isOpen(key) && (
              <div>
                {group.subCategories &&
                  Object.entries(group.subCategories).map(
                    ([subKey, category]) =>
                      renderCategory(subKey, category, `${key}.${subKey}`)
                  )}
                {group.players &&
                  Object.entries(group.players).map(([playerKey, playerData]) =>
                    renderPlayerSection(playerData, `${key}.${playerKey}`)
                  )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default FilterList
