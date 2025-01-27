import React, { useState } from 'react'

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
  score: {
    title: 'Score',
    subCategories: {
      pointScore: {
        title: 'Point Score',
        values: [
          '0-0',
          '15-0',
          '30-0',
          '40-0',
          '0-15',
          '15-15',
          '30-15',
          '40-15',
          '0-30',
          '15-30',
          '30-30',
          '40-30',
          '0-40',
          '15-40',
          '30-40',
          '40-40'
        ]
      },
      gameScore: {
        title: 'Game Score',
        values: [
          '0-0',
          '1-0',
          '2-0',
          '3-0',
          '4-0',
          '5-0',
          '6-0',
          '0-1',
          '1-1',
          '2-1',
          '3-1',
          '4-1',
          '5-1',
          '6-1',
          '0-2',
          '1-2',
          '2-2',
          '3-2',
          '4-2',
          '5-2',
          '6-2',
          '0-3',
          '1-3',
          '2-3',
          '3-3',
          '4-3',
          '5-3',
          '6-3',
          '0-4',
          '1-4',
          '2-4',
          '3-4',
          '4-4',
          '5-4',
          '6-4',
          '0-5',
          '1-5',
          '2-5',
          '3-5',
          '4-5',
          '5-5',
          '6-5',
          '0-6',
          '1-6',
          '2-6',
          '3-6',
          '4-6',
          '5-6',
          '6-6'
        ]
      },
      setScore: {
        title: 'Set Score',
        values: ['0-0', '1-0', '0-1', '1-1']
      },
      tiebreakScore: {
        title: 'Tiebreak Score',
        values: [
          '0-0',
          '1-0',
          '2-0',
          '3-0',
          '4-0',
          '5-0',
          '6-0',
          '7-0',
          '0-1',
          '1-1',
          '2-1',
          '3-1',
          '4-1',
          '5-1',
          '6-1',
          '7-1',
          '0-2',
          '1-2',
          '2-2',
          '3-2',
          '4-2',
          '5-2',
          '6-2',
          '7-2',
          '0-3',
          '1-3',
          '2-3',
          '3-3',
          '4-3',
          '5-3',
          '6-3',
          '7-3',
          '0-4',
          '1-4',
          '2-4',
          '3-4',
          '4-4',
          '5-4',
          '6-4',
          '7-4',
          '0-5',
          '1-5',
          '2-5',
          '3-5',
          '4-5',
          '5-5',
          '6-5',
          '7-5',
          '0-6',
          '1-6',
          '2-6',
          '3-6',
          '4-6',
          '5-6',
          '6-6',
          '7-6',
          '0-7',
          '1-7',
          '2-7',
          '3-7',
          '4-7',
          '5-7',
          '6-7',
          '7-7'
        ]
      },
      breakPoint: {
        title: 'Break Point',
        type: 'checkbox'
      }
    }
  },
  serve: {
    title: 'Serve',
    players: {
      player1: {
        title: 'Player 1',
        categories: {
          servePlacement: {
            title: 'Serve Placement',
            values: ['Wide', 'Body', 'T']
          },
          serveResult: {
            title: 'Serve Result',
            values: ['Ace', 'Ball In Play']
          },
          serveSide: {
            title: 'Serve Side',
            values: ['Deuce', 'Ad']
          }
        }
      },
      player2: {
        title: 'Player 2',
        categories: {
          servingSide: {
            title: 'Serving Side',
            values: ['Deuce', 'Ad']
          },
          servePlacement: {
            title: 'Serve Placement',
            values: ['Wide', 'Body', 'T']
          },
          serveResult: {
            title: 'Serve Result',
            values: ['Ace', 'Ball In Play']
          }
        }
      }
    }
  },
  return: {
    title: 'Return',
    players: {
      player1: {
        title: 'Player 1',
        categories: {
          returningSide: {
            title: 'Returning Side',
            values: ['Deuce', 'Ad']
          },
          returnPlacement: {
            title: 'Return Placement',
            values: ['Down the Line', 'Cross Court']
          }
        }
      },
      player2: {
        title: 'Player 2',
        categories: {
          returnFhBh: {
            title: 'Return Forehand/Backhand',
            values: ['Forehand', 'Backhand']
          },
          returnPlacement: {
            title: 'Return Placement',
            values: ['Down the Line', 'Cross Court']
          }
        }
      }
    }
  },
  rally: {
    title: 'Rally',
    subCategories: {
      rallyLength: {
        title: 'Rally Length',
        values: ['1-4', '5-8', '9+']
      },
      pointWonBy: {
        title: 'Point Won By',
        values: ['Player 1', 'Player 2']
      },
      shotType: {
        title: 'Shot Type',
        values: ['Lob', 'Approach', 'Dropshot', 'Slice', 'Overhead']
      },
      approach: {
        title: 'Approach',
        type: 'checkbox'
      }
    }
  },
  lastShot: {
    title: 'Last Shot',
    subCategories: {
      winner: {
        title: 'Winner',
        type: 'checkbox'
      },
      forcedError: {
        title: 'Forced Error',
        type: 'checkbox'
      },
      unforcedError: {
        title: 'Unforced Error',
        type: 'checkbox'
      }
    }
  }
}

const FilterList = ({
  pointsData,
  filterList,
  setFilterList,
  showPercent,
  showCount
}) => {
  const [openSections, setOpenSections] = useState({})

  const toggleSection = (path) => {
    setOpenSections((prev) => ({
      ...prev,
      [path]: !prev[path]
    }))
  }

  const isOpen = (path) => openSections[path] || false

  const addFilter = (key, value) => {
    const isDuplicate = filterList.some(
      ([filterKey, filterValue]) => filterKey === key && filterValue === value
    )
    if (!isDuplicate) {
      // Check if the value is part of an exclusive group
      const group = Object.values(exclusiveGroups).find((group) =>
        group.includes(value)
      )
      // If it is, remove any other filters from the same group
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

  const isActiveFilter = (key, value) => {
    return filterList.some(
      ([filterKey, filterValue]) => filterKey === key && filterValue === value
    )
  }

  const renderCategoryValues = (values, key, path) => {
    return values.map((value) => (
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

  const renderSubCategories = (categories, parentPath = '') => {
    return Object.entries(categories).map(([key, category]) => {
      const currentPath = parentPath ? `${parentPath}.${key}` : key

      // For single checkbox items
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

      // For expandable categories with values
      return (
        <div key={key} style={{ marginLeft: '30px' }}>
          <div
            onClick={() => toggleSection(currentPath)}
            style={{
              cursor: 'pointer',
              fontSize: '20px',
              padding: '6px 0',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <span style={{ marginRight: '10px', width: '20px' }}>
              {isOpen(currentPath) ? '▼' : '▶'}
            </span>
            {category.title}
          </div>
          {isOpen(currentPath) &&
            category.values &&
            renderCategoryValues(category.values, key, currentPath)}
        </div>
      )
    })
  }

  const renderPlayerSection = (playerData, path) => {
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
        {isOpen(path) && renderSubCategories(playerData.categories, path)}
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
      {Object.entries(filterGroups).map(([key, group]) => (
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
                renderSubCategories(group.subCategories, key)}
              {group.players &&
                Object.entries(group.players).map(([playerKey, playerData]) =>
                  renderPlayerSection(playerData, `${key}.${playerKey}`)
                )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default FilterList
