import React, { useEffect, useState, useMemo } from 'react';
import styles from '../styles/FilterList.module.css';
import nameMap from '../services/nameMap.js';

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
  // Memoize the filtered keys and unique values for performance
  const keys = useMemo(() => {
    return Object.keys(nameMap).filter(
      (key) =>
        pointsData &&
        pointsData.some((point) =>
          Object.prototype.hasOwnProperty.call(point, key)
        )
    );
  });

  const uniqueValues = useMemo(() => {
    const result = {};
    keys.forEach((key) => {
      result[key] = [...new Set(pointsData.map((point) => point[key]))].sort();
    });
    return result;
  }, [pointsData, keys]);

  const [openKey, setOpenKey] = useState(null);

  // Apply filters from the URL when the component mounts
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const initialFilters = [];

    urlParams.forEach((value, key) => {
      initialFilters.push([key, value]);
    });

    if (initialFilters.length > 0) {
      setFilterList(initialFilters);
    }
  }, [setFilterList]);

  // Update the URL whenever the filterList changes
  useEffect(() => {
    const urlParams = new URLSearchParams();

    // Append each filter to the URL params
    filterList.forEach(([key, value]) => {
      urlParams.append(key, value);
    });

    // Update the URL with the new query string
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}?${urlParams.toString()}`
    );
  }, [filterList]);

  const toggleOpen = (key) => {
    setOpenKey((prevKey) => (prevKey === key ? null : key));
  };

  const addFilter = (key, value) => {
    // Check if the value is already in the filter list
    const isDuplicate = filterList.some(
        ([filterKey, filterValue]) => filterKey === key && filterValue === value
    );

    if (!isDuplicate) {
        // Find the group associated with the filter value
        const group = Object.values(exclusiveGroups).find((group) =>
            group.includes(value)
        );

        // Update the filter list by removing other filters in the same exclusive group
        const updatedFilterList = filterList.filter(
            ([filterKey, filterValue]) => !(group && group.includes(filterValue))
        );

        // Add the new filter to the updated list
        setFilterList([...updatedFilterList, [key, value]]);
    }
};


  const removeFilter = (key, value) => {
    setFilterList((prev) =>
      prev.filter(([filterKey, filterValue]) => !(filterKey === key && filterValue === value))
    );
  };

  const countFilteredPointsForValue = useMemo(() => {
    return (key, value) => {
      return pointsData.filter((point) => point[key] === value).length;
    };
  }, [pointsData]);

  const countFilteredPointsTotal = useMemo(() => {
    return (key) => {
      return pointsData.reduce((total, point) => {
        if (point[key] !== '' && point[key] !== null) {
          return total + 1;
        }
        return total;
      }, 0);
    };
  }, [pointsData]);

  const isActiveFilter = useMemo(() => {
    return (key, value) => {
      return filterList.some(([filterKey, filterValue]) => filterKey === key && filterValue === value);
    };
  }, [filterList]);

  return (
    <div>
      <ul className={styles.availableFilterList}>
        {keys.map((key) => (
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
                          e.stopPropagation(); // Prevent click from toggling the open key
                          if (isActiveFilter(key, value)) {
                            removeFilter(key, value);
                          } else {
                            addFilter(key, value);
                          }
                        }}
                      >
                        <li>{value}</li>

                        {showPercent && (
                          <li>
                            {Math.round(
                              (countFilteredPointsForValue(key, value) /
                                countFilteredPointsTotal(key)) * 100
                            )}
                            %
                          </li>
                        )}
                        {showCount && (
                          <li>
                            {countFilteredPointsForValue(key, value)} / {countFilteredPointsTotal(key)}
                          </li>
                        )}
                      </div>
                    )
                )}
              </ul>
            </li>
          </div>
        ))}
      </ul>
    </div>
  );
};

export default FilterList;
