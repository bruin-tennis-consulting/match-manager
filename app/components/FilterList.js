import React, { useState, useMemo } from 'react'
import { filterGroups } from '../services/filterGroups'

const FilterList = ({
  pointsData,
  filterList,
  setFilterList,
  showPercent,
  showCount
}) => {
  const [openSections, setOpenSections] = useState({})

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

  const toggleSection = (path) => {
    setOpenSections((prev) => ({
      ...prev,
      [path]: !prev[path]
    }))
  }

  const isOpen = (path) => openSections[path] || false

  const addFilter = (key, value) => {
    if (
      !filterList.some(
        ([filterKey, filterValue]) => filterKey === key && filterValue === value
      )
    ) {
      setFilterList([...filterList, [key, value]])
    }
  }

  const removeFilter = (key, value) => {
    setFilterList(
      filterList.filter(
        ([filterKey, filterValue]) =>
          !(filterKey === key && filterValue === value)
      )
    )
  }

  const isActiveFilter = (key, value) => {
    return filterList.some(
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
          marginLeft: '30px',
          fontSize: '20px',
          padding: '6px 0',
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
          style={{ width: '20px', height: '20px', marginRight: '10px' }}
        />
        <span style={{ flex: 1 }}>{value}</span>
        {showPercent && (
          <span style={{ marginLeft: '10px' }}>
            {Math.round(
              (countFilteredPointsForValue(key, value) /
                countFilteredPointsTotal(key)) *
                100
            )}
            %
          </span>
        )}
        {showCount && (
          <span style={{ marginLeft: '10px' }}>
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
            marginLeft: '30px',
            fontSize: '18px',
            padding: '6px 0',
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
            style={{ width: '20px', height: '20px', marginRight: '10px' }}
          />
          <span>{category.title}</span>
          {showPercent && (
            <span style={{ marginLeft: '10px' }}>
              {Math.round(
                (countFilteredPointsForValue(key, 'Yes') /
                  countFilteredPointsTotal(key)) *
                  100
              )}
              %
            </span>
          )}
          {showCount && (
            <span style={{ marginLeft: '10px' }}>
              {countFilteredPointsForValue(key, 'Yes')} /{' '}
              {countFilteredPointsTotal(key)}
            </span>
          )}
        </div>
      )
    }

    return (
      <div key={key} style={{ marginLeft: '30px' }}>
        <div
          onClick={() => toggleSection(path)}
          style={{
            cursor: 'pointer',
            fontSize: '20px',
            padding: '6px 0',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <span style={{ marginRight: '10px', width: '20px' }}>
            {isOpen(path) ? '▼' : '▶'}
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

    return (
      <div style={{ marginLeft: '30px' }}>
        <div
          onClick={() => toggleSection(path)}
          style={{
            cursor: 'pointer',
            fontSize: '22px',
            padding: '6px 0',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <span style={{ marginRight: '10px', width: '20px' }}>
            {isOpen(path) ? '▼' : '▶'}
          </span>
          {playerData.title}
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
        border: '1px solid #ccd0d4',
        background: '#fff',
        borderRadius: '4px',
        padding: '15px 20px',
        fontSize: '22px'
      }}
    >
      {Object.entries(filterGroups).map(([key, group]) => {
        if (!hasSectionFilters(group)) return null

        return (
          <div key={key} style={{ marginBottom: '15px' }}>
            <div
              onClick={() => toggleSection(key)}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '8px 0'
              }}
            >
              <span style={{ marginRight: '10px', width: '20px' }}>
                {isOpen(key) ? '▼' : '▶'}
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
