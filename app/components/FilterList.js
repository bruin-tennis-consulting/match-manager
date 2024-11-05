// components/FilterList.js

import React, { useEffect, useState } from 'react'
import styles from '../styles/FilterList.module.css'
// This file renammes columns to more human-readable names
import nameMap from '../services/nameMap.js'

const exclusiveGroups = {
  player1ReturnFhBh: ['Forehand', 'Backhand'],
  player1ReturnPlacement: ['Down the Line', 'Crosscourt'],
  player1LastShotResult: ['Winner', 'Error'],
  player1LastShotFhBh: ['Forehand', 'Backhand'],
  player1LastShotPlacement: ['Down the Line', 'Crosscourt'],
  side: ['Deuce', 'Ad']
}

const FilterList = ({
  pointsData,
  filterList,
  setFilterList,
  showPercent,
  showCount
}) => {
  // only keep relevant keys
  const keys = Object.keys(nameMap).filter(
    (key) =>
      pointsData &&
      pointsData.some((point) =>
        Object.prototype.hasOwnProperty.call(point, key)
      )
  )
  const uniqueValues = {}

  // Iterate through filtered keys and populate uniqueValues
  keys.forEach((key) => {
    uniqueValues[key] = [
      ...new Set(pointsData.map((point) => point[key]))
    ].sort()
  })

  // State for the open key
  const [openKey, setOpenKey] = useState(null)

  // Effect to reset open key when pointsData changes
  useEffect(() => {
    setOpenKey(null)
  }, [pointsData])

  const toggleOpen = (key) => {
    if (openKey === key) {
      setOpenKey(null)
    } else {
      setOpenKey(key)
    }
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

  // Counts points for each filter
  const countFilteredPointsForValue = (key, value) => {
    return pointsData.filter((point) => point[key] === value).length
  }

  const countFilteredPointsTotal = (key) => {
    return pointsData.reduce((total, point) => {
      // Check if the value attribute is not an empty string
      if (point[key] !== '' && point[key] !== null) {
        return total + 1 // Add 1 to the total if this point has a value specific to this category (key)
      }
      // Otherwise, just return the current total without adding anything
      return total
    }, 0)
  }

  // Function to determine if the value is an active filter
  const isActiveFilter = (key, value) => {
    return filterList.some(
      ([filterKey, filterValue]) => filterKey === key && filterValue === value
    )
  }

  // Sort the filterList array in alphabetical order
  // const sortedFilterList = filterList.sort((a, b) => a[0].localeCompare(b[0]));
  return (
    <>
      <div>
        <ul className={styles.availableFilterList}>
          {keys.map((key) => {
            return (
              <div
                className={styles.availableFilterItem}
                key={key}
                onClick={() => toggleOpen(key)}
              >
                <li>
                  <strong>{nameMap[key]}</strong>
                  <ul
                    className={styles.filterValuesList}
                    style={{ display: openKey === key ? 'block' : 'none' }}
                  >
                    {/* { console.log(uniqueValues)} */}
                    {uniqueValues[key].map(
                      (value) =>
                        value !== '' &&
                        value !== null && (
                          <div
                            className={styles.filterValueItem}
                            key={value}
                            style={{
                              cursor: 'pointer',
                              backgroundColor: isActiveFilter(key, value)
                                ? '#8BB8E8'
                                : ''
                            }}
                            onClick={(e) => {
                              e.stopPropagation() // Prevent the click from toggling the open key
                              if (isActiveFilter(key, value)) {
                                removeFilter(key, value)
                              } else {
                                addFilter(key, value)
                              }
                            }}
                          >
                            <li>{value}</li>
                            {/* Point Percentage */}

                            {/* {console.log(value)}  */}
                            {showPercent && value && (
                              // make a sum
                              <li>
                                {Math.round(
                                  (countFilteredPointsForValue(key, value) /
                                    Math.round(
                                      countFilteredPointsTotal(key, value)
                                    )) /* ERROR IS HERE */ *
                                    100
                                )}
                                %
                              </li>
                            )}
                            {/* Point Count */}
                            {showCount && value && (
                              <li>
                                {countFilteredPointsForValue(key, value)} /{' '}
                                {
                                  Math.round(
                                    countFilteredPointsTotal(key, value)
                                  ) /* ERROR IS HERE */
                                }
                              </li>
                            )}
                          </div>
                        )
                    )}
                  </ul>
                </li>
              </div>
            )
            // } else {
            //   return null; // Skip rendering if key is not in the map
            // }
          })}
        </ul>
      </div>
    </>
  )
}

export default FilterList
