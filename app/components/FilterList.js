import React, { useEffect, useState } from 'react';
import styles from '../styles/FilterList.module.css';
import nameMap from '../services/nameMap.js';
import getTeams from '@/app/services/getTeams.js';

const universalKeys = ['rallyCountFreq', 'pointWonBy', 'side', 'setNum', 'pointScore']; // Define universal keys

const FilterList = ({
  pointsData,
  filterList,
  setFilterList,
  showPercent,
  showCount,
  clientTeam,
  opponentTeam
}) => {
  const [clientLogo, setClientLogo] = useState('');
  const [opponentLogo, setOpponentLogo] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null); // Track selected player

  // Fetch logos based on clientTeam and opponentTeam names
  useEffect(() => {
    const fetchLogos = async () => {
      const allTeams = await getTeams();
      const clientLogoURL = allTeams.find(team => team.name === clientTeam)?.logoUrl || '';
      const opponentLogoURL = allTeams.find(team => team.name === opponentTeam)?.logoUrl || '';
      setClientLogo(clientLogoURL);
      setOpponentLogo(opponentLogoURL);
    };
    fetchLogos();
  }, [clientTeam, opponentTeam]);

  // Filter points based on the selected player
  const filterPointsByPlayer = (points, player) => {
    return points.filter((point) => point[`player${player}Name`] !== null);
  };

  const playerFilteredData = filterPointsByPlayer(pointsData, selectedPlayer);
  const keys = selectedPlayer === 2 ? universalKeys : Object.keys(nameMap).filter(
    (key) =>
      playerFilteredData &&
      playerFilteredData.some((point) =>
        Object.prototype.hasOwnProperty.call(point, key)
      )
  );

  const uniqueValues = {};
  keys.forEach((key) => {
    uniqueValues[key] = [
      ...new Set(playerFilteredData.map((point) => point[key]))
    ].sort();
  });

  const [openKey, setOpenKey] = useState(null);
  useEffect(() => {
    setOpenKey(null);
  }, [pointsData]);

  const toggleOpen = (key) => {
    setOpenKey(openKey === key ? null : key);
  };

  const addFilter = (key, value) => {
    const isDuplicate = filterList.some(
      ([filterKey, filterValue]) => filterKey === key && filterValue === value
    );
    if (!isDuplicate) {
      setFilterList([...filterList, [key, value]]);
    }
  };

  const removeFilter = (key, value) => {
    setFilterList(filterList.filter(
      ([filterKey, filterValue]) => !(filterKey === key && filterValue === value)
    ));
  };

  const isActiveFilter = (key, value) => {
    return filterList.some(
      ([filterKey, filterValue]) => filterKey === key && filterValue === value
    );
  };

  return (
    <>
     <div className={styles.selectPlayerContainer}>
  {/* <h3 className={styles.selectPlayerText}>Select Player Perspective:</h3> */}
  <div className={styles.teamLogosContainer}>
    <div
      className={`${styles.logoWrapper} ${selectedPlayer === 1 ? styles.selectedWrapper : ''}`}
      onClick={() => setSelectedPlayer(1)}
    >
      <img
        src={clientLogo}
        alt="Client Logo"
        className={`${styles.teamLogo} ${selectedPlayer === 1 ? styles.selectedLogo : ''}`}
      />
      <span className={styles.teamLabel}>Client</span>
    </div>
    <div
      className={`${styles.logoWrapper} ${selectedPlayer === 2 ? styles.selectedWrapper : ''}`}
      onClick={() => setSelectedPlayer(2)}
    >
      <img
        src={opponentLogo}
        alt="Opponent Logo"
        className={`${styles.teamLogo} ${selectedPlayer === 2 ? styles.selectedLogo : ''}`}
      />
      <span className={styles.teamLabel}>Opponent</span>
    </div>
  </div>
</div>


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
                            e.stopPropagation();
                            isActiveFilter(key, value)
                              ? removeFilter(key, value)
                              : addFilter(key, value);
                          }}
                        >
                          <li>{value}</li>
                          {showPercent && value && (
                            <li>
                              {Math.round(
                                (countFilteredPointsForValue(key, value) /
                                  countFilteredPointsTotal(key)) *
                                  100
                              )}
                              %
                            </li>
                          )}
                          {showCount && value && (
                            <li>
                              {countFilteredPointsForValue(key, value)} /{' '}
                              {countFilteredPointsTotal(key)}
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
    </>
  );
};

export default FilterList;
