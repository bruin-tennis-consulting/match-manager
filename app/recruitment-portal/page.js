'use client'

import { useState, useEffect, useMemo } from 'react'
import styles from '@/app/styles/RecruitmentPortal.module.css'

const PAGE_SIZE = 25

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3)
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}

function Stat({ label, value }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value ?? '—'}</div>
    </div>
  )
}

export default function RecruitmentPortal() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [page, setPage] = useState(1)

  const [searchName, setSearchName] = useState('')
  const [filterGender, setFilterGender] = useState('all')
  const [filterAge, setFilterAge] = useState('all')
  const [filterState, setFilterState] = useState('all')

  useEffect(() => {
    fetch('/api/players')
      .then((r) => r.json())
      .then((data) => {
        setPlayers(data)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  // Build state options from actual data
  const states = useMemo(() => {
    const s = new Set(players.map((p) => p.usta_state).filter(Boolean))
    return Array.from(s).sort()
  }, [players])

  const filtered = useMemo(() => {
    return players.filter((p) => {
      if (
        searchName &&
        !p.full_name?.toLowerCase().includes(searchName.toLowerCase())
      )
        return false
      if (filterGender !== 'all' && p.gender !== filterGender) return false
      if (filterAge !== 'all' && p.usta_age_division !== filterAge) return false
      if (filterState !== 'all' && p.usta_state !== filterState) return false
      return true
    })
  }, [players, searchName, filterGender, filterAge, filterState])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1)
  }, [searchName, filterGender, filterAge, filterState])

  function resetFilters() {
    setSearchName('')
    setFilterGender('all')
    setFilterAge('all')
    setFilterState('all')
  }

  if (loading) return <div className={styles.loading}>Loading players...</div>
  if (error)
    return <div className={styles.error}>Error loading players: {error}</div>

  const pageNums = getPageNumbers(page, totalPages)

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <h2 className={styles.title}>Recruiting Portal</h2>
        <span className={styles.betaBadge}>Beta</span>
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by name..."
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
        />
        <select
          className={styles.select}
          value={filterGender}
          onChange={(e) => setFilterGender(e.target.value)}
        >
          <option value="all">All Genders</option>
          <option value="male">Boys</option>
          <option value="female">Girls</option>
        </select>
        <select
          className={styles.select}
          value={filterAge}
          onChange={(e) => setFilterAge(e.target.value)}
        >
          <option value="all">All Ages</option>
          <option value="18s">18s</option>
          <option value="16s">16s</option>
          <option value="14s">14s</option>
          <option value="12s">12s</option>
        </select>
        <select
          className={styles.select}
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
        >
          <option value="all">All States</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className={styles.resetBtn} onClick={resetFilters}>
          Reset
        </button>
      </div>

      <div className={styles.resultsCount}>
        {filtered.length} player{filtered.length !== 1 ? 's' : ''}
        {filtered.length !== players.length &&
          ` (filtered from ${players.length})`}
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>USTA Rank</th>
              <th>Name</th>
              <th>Gender</th>
              <th>Age</th>
              <th>State</th>
              <th>Section</th>
              <th>USTA Pts</th>
              <th>UTR Rating</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((p) => (
              <tr
                key={p.id}
                className={`${styles.row} ${selected?.id === p.id ? styles.rowSelected : ''}`}
                onClick={() => setSelected(selected?.id === p.id ? null : p)}
              >
                <td className={styles.rankCell}>{p.usta_rank ?? '—'}</td>
                <td className={styles.nameCell}>{p.full_name}</td>
                <td>
                  {p.gender === 'male'
                    ? 'M'
                    : p.gender === 'female'
                      ? 'F'
                      : '—'}
                </td>
                <td>{p.usta_age_division ?? '—'}</td>
                <td>{p.usta_state ?? '—'}</td>
                <td>{p.usta_section ?? '—'}</td>
                <td>
                  {p.usta_points != null ? p.usta_points.toLocaleString() : '—'}
                </td>
                <td>{p.utr_rating ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ‹ Prev
          </button>
          {pageNums.map((n, i) =>
            n === '...' ? (
              <span key={`ellipsis-${i}`} className={styles.ellipsis}>
                …
              </span>
            ) : (
              <button
                key={n}
                className={page === n ? styles.pageActive : ''}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            )
          )}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next ›
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className={styles.modalOverlay} onClick={() => setSelected(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalName}>{selected.full_name}</h3>
                <div className={styles.modalMeta}>
                  {selected.gender === 'male' ? 'Boys' : 'Girls'}
                  {selected.usta_age_division
                    ? ` · ${selected.usta_age_division}`
                    : ''}
                  {selected.grad_year
                    ? ` · Class of ${selected.grad_year}`
                    : ''}
                  {selected.country_code ? ` · ${selected.country_code}` : ''}
                </div>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setSelected(null)}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* USTA */}
              {selected.usta_rank != null && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>USTA</div>
                  <div className={styles.grid}>
                    <Stat
                      label="National Rank"
                      value={`#${selected.usta_rank}`}
                    />
                    <Stat
                      label="Total Points"
                      value={selected.usta_points?.toLocaleString()}
                    />
                    <Stat
                      label="Singles Points"
                      value={selected.usta_singles?.toLocaleString()}
                    />
                    <Stat
                      label="Doubles Points"
                      value={selected.usta_doubles?.toLocaleString()}
                    />
                    <Stat
                      label="Bonus Points"
                      value={selected.usta_bonus?.toLocaleString()}
                    />
                    <Stat
                      label="Age Division"
                      value={selected.usta_age_division}
                    />
                    <Stat label="Section" value={selected.usta_section} />
                    <Stat label="District" value={selected.usta_district} />
                    <Stat label="State" value={selected.usta_state} />
                    <Stat label="City" value={selected.usta_city} />
                  </div>
                </div>
              )}

              {/* UTR */}
              {selected.utr_rating != null && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>UTR</div>
                  <div className={styles.grid}>
                    <Stat label="UTR Rating" value={selected.utr_rating} />
                    <Stat
                      label="UTR Ranking"
                      value={
                        selected.utr_ranking != null
                          ? `#${selected.utr_ranking}`
                          : null
                      }
                    />
                    <Stat
                      label="3-Month Rating"
                      value={selected.utr_three_month}
                    />
                    <Stat label="Trend" value={selected.utr_trend} />
                    <Stat
                      label="High School"
                      value={selected.utr_high_school}
                    />
                    <Stat
                      label="HS State"
                      value={selected.utr_high_school_state}
                    />
                    <Stat label="Category" value={selected.utr_scraped_tag} />
                  </div>
                </div>
              )}

              {/* Player info */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Player Info</div>
                <div className={styles.grid}>
                  <Stat label="Grad Year" value={selected.grad_year} />
                  <Stat label="Country" value={selected.country_code} />
                  <Stat label="Region" value={selected.region} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
