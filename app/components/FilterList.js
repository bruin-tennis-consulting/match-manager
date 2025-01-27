import React, { useState, useEffect } from 'react'
// import styles from '@/app/styles/FilterList.module.css'
// This file renames columns to more human-readable names
import nameMap from '@/app/services/nameMap.js'

// Define groups of values that are mutually exclusive
const exclusiveGroups = {
  player1ReturnFhBh: ['Forehand', 'Backhand'],
  player1ReturnPlacement: ['Down the Line', 'Crosscourt'],
  player1LastShotResult: ['Winner', 'Error'],
  player1LastShotFhBh: ['Forehand', 'Backhand'],
  player1LastShotPlacement: ['Down the Line', 'Crosscourt'],
  side: ['Deuce', 'Ad']
}

const filterGroups = {
  serve: {
    title: 'Serve',
    keys: [
      'player1ServePlacement',
      'player1ServeResult',
      '1st Serve In',
      '2nd Serve In',
      'Ace',
      'Double Fault'
    ]
  },
  return: {
    title: 'Return',
    keys: ['player1ReturnFhBh', 'player1ReturnPlacement']
  },
  lastShot: {
    title: 'Last Shot',
    keys: [
      'player1LastShotFhBh',
      'player1LastShotPlacement',
      'player1LastShotResult'
    ]
  },
  pointInfo: {
    title: 'Point Information',
    keys: ['rallyCountFreq', 'atNetPlayer1', 'pointWonBy', 'side', 'setNum']
  },
  special: {
    title: 'Special Points',
    keys: [
      'isPressurePoint',
      'isUnforcedError',
      'isSecondServeAttacked',
      'isAggressiveServePlusOne',
      'pointScore'
    ]
  }
}

const FilterList = ({
  pointsData,
  filterList,
  setFilterList,
  showPercent,
  showCount
}) => {
  const [openGroups, setOpenGroups] = useState({})
  const [openKeys, setOpenKeys] = useState({})

  // Keep track of unique values for each key
  const uniqueValues = {}
  Object.keys(filterGroups).forEach((groupKey) => {
    filterGroups[groupKey].keys.forEach((key) => {
      if (
        pointsData &&
        pointsData.some((point) =>
          Object.prototype.hasOwnProperty.call(point, key)
        )
      ) {
        uniqueValues[key] = [
          ...new Set(pointsData.map((point) => point[key]))
        ].sort()
      }
    })
  })

  // Effect to reset open keys when pointsData changes
  useEffect(() => {
    setOpenGroups({})
    setOpenKeys({})
  }, [pointsData])

  const toggleGroup = (groupKey) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }))
  }

  const toggleKey = (key) => {
    setOpenKeys((prev) => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const addFilter = (key, value) => {
    const isDuplicate = filterList.some(
      ([filterKey, filterValue]) => filterKey === key && filterValue === value
    )
    if (!isDuplicate) {
      const group = Object.values(exclusiveGroups).find((group) =>
        group.includes(value)
      )
      const updatedFilterList = filterList.filter(
        ([filterKey, filterValue]) => !(group && group.includes(filterValue))
      )
      setFilterList([...updatedFilterList, [key, value]])
    }
  }

  const removeFilter = (key, value) => {
    const updatedFilterList = filterList.filter(
      ([filterKey, filterValue]) =>
        !(filterKey === key && filterValue === value)
    )
    setFilterList(updatedFilterList)
  }

  const isActiveFilter = (key, value) => {
    return filterList.some(
      ([filterKey, filterValue]) => filterKey === key && filterValue === value
    )
  }

  const commonStyles = {
    checkbox: {
      width: '20px',
      height: '20px',
      marginRight: '10px'
    },
    expandIcon: {
      marginRight: '10px',
      width: '20px',
      display: 'inline-block'
    }
  }

  return (
    <div
      className="filter-container"
      style={{
        border: '1px solid #ccd0d4',
        background: '#fff',
        borderRadius: '4px',
        padding: '15px 20px',
        fontSize: '20px'
      }}
    >
      {Object.entries(filterGroups).map(([groupKey, group]) => (
        <div key={groupKey} style={{ marginBottom: '15px' }}>
          <div
            onClick={() => toggleGroup(groupKey)}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '8px 0',
              fontSize: '24px'
            }}
          >
            <span style={commonStyles.expandIcon}>
              {openGroups[groupKey] ? '▼' : '▶'}
            </span>
            <span>{group.title}</span>
          </div>

          {openGroups[groupKey] && (
            <div style={{ paddingLeft: '30px' }}>
              {group.keys.map((key) => {
                if (!uniqueValues[key]) return null

                return (
                  <div key={key} style={{ marginTop: '10px' }}>
                    <div
                      onClick={() => toggleKey(key)}
                      style={{
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '6px 0',
                        fontSize: '22px'
                      }}
                    >
                      <span style={commonStyles.expandIcon}>
                        {openKeys[key] ? '▼' : '▶'}
                      </span>
                      <span>{nameMap[key] || key}</span>
                    </div>

                    {openKeys[key] && (
                      <div style={{ paddingLeft: '30px' }}>
                        {uniqueValues[key].map(
                          (value) =>
                            value !== '' &&
                            value !== null && (
                              <div
                                key={`${key}-${value}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '6px 0',
                                  fontSize: '20px'
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
                                  style={commonStyles.checkbox}
                                />
                                <span style={{ flex: 1 }}>{value}</span>
                                {showPercent && (
                                  <span
                                    style={{
                                      marginLeft: '10px',
                                      color: '#666'
                                    }}
                                  >
                                    {Math.round(
                                      (pointsData.filter(
                                        (point) => point[key] === value
                                      ).length /
                                        pointsData.filter(
                                          (point) =>
                                            point[key] !== '' &&
                                            point[key] !== null
                                        ).length) *
                                        100
                                    )}
                                    %
                                  </span>
                                )}
                                {showCount && (
                                  <span
                                    style={{
                                      marginLeft: '10px',
                                      color: '#666'
                                    }}
                                  >
                                    {
                                      pointsData.filter(
                                        (point) => point[key] === value
                                      ).length
                                    }{' '}
                                    /{' '}
                                    {
                                      pointsData.filter(
                                        (point) =>
                                          point[key] !== '' &&
                                          point[key] !== null
                                      ).length
                                    }
                                  </span>
                                )}
                              </div>
                            )
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default FilterList
