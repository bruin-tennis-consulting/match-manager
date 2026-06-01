'use client'

import { useState, useEffect, useMemo } from 'react'
import styles from '@/app/styles/RecruitmentPortal.module.css'

const PAGE_SIZE = 25

const AGE_DIVISION_LABELS = {
  '18s': '18U',
  '16s': '16U',
  '14s': '14U',
  '12s': '12U'
}

function inferAgeDivision(p) {
  if (p.usta_age_division) return p.usta_age_division
  if (!p.grad_year) return null
  const yearsOut = p.grad_year - new Date().getFullYear()
  if (yearsOut <= 1) return '18s'
  if (yearsOut <= 3) return '16s'
  if (yearsOut <= 5) return '14s'
  return '12s'
}

function formatAgeDivision(div) {
  return AGE_DIVISION_LABELS[div] ?? div ?? '—'
}

// Years from the current class that each age division spans. USTA only gives us
// an age division (e.g. 18U), which covers ~2 graduating classes, so when we
// have no exact grad_year we estimate a 2-year range instead of a fake single
// year. Offsets are kept in sync with inferAgeDivision's thresholds.
const AGE_DIVISION_OFFSET = { '18s': 0, '16s': 2, '14s': 4, '12s': 6 }

// Returns { estimated, short, full } for a player's graduating class, or null.
// Exact grad_year (TR/UTR) -> single year. Age-division only (USTA) -> range.
function getClassInfo(p) {
  if (p.grad_year) {
    return {
      estimated: false,
      short: `'${String(p.grad_year).slice(-2)}`,
      full: String(p.grad_year)
    }
  }
  const offset = AGE_DIVISION_OFFSET[inferAgeDivision(p)]
  if (offset == null) return null
  const a = new Date().getFullYear() + offset
  const b = a + 1
  return {
    estimated: true,
    short: `'${String(a).slice(-2)}–'${String(b).slice(-2)}`,
    full: `${a}–${b}`
  }
}

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
  const [filterGender, setFilterGender] = useState('male')
  const [filterAge, setFilterAge] = useState('18s')
  const [filterState, setFilterState] = useState('all')
  const [sortBy, setSortBy] = useState('usta')

  useEffect(() => {
    fetch('/api/players')
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          setError(data.error ?? 'Unexpected response from server')
          setLoading(false)
          return
        }
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
    const s = new Set(
      [
        ...players.map((p) => p.usta_state),
        ...players.map((p) => p.tr_state)
      ].filter(Boolean)
    )
    return Array.from(s).sort()
  }, [players])

  const filtered = useMemo(() => {
    let result = players.filter((p) => {
      if (
        searchName &&
        !p.full_name?.toLowerCase().includes(searchName.toLowerCase())
      )
        return false
      if (filterGender !== 'all' && p.gender !== filterGender) return false
      if (filterAge !== 'all' && inferAgeDivision(p) !== filterAge) return false
      if (
        filterState !== 'all' &&
        p.usta_state !== filterState &&
        p.tr_state !== filterState
      )
        return false
      if (sortBy === 'utr' && p.utr_rating == null) return false
      if (sortBy === 'tr' && p.tr_rank == null) return false
      return true
    })

    if (sortBy === 'utr') {
      result = [...result].sort(
        (a, b) => (b.utr_rating ?? 0) - (a.utr_rating ?? 0)
      )
    } else if (sortBy === 'tr') {
      result = [...result].sort(
        (a, b) => (a.tr_rank ?? Infinity) - (b.tr_rank ?? Infinity)
      )
    }

    return result
  }, [players, searchName, filterGender, filterAge, filterState, sortBy])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, filtered.length)
  const paginated = filtered.slice(rangeStart - 1, rangeEnd)

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1)
  }, [searchName, filterGender, filterAge, filterState, sortBy])

  function resetFilters() {
    setSearchName('')
    setFilterGender('male')
    setFilterAge('18s')
    setFilterState('all')
    setSortBy('usta')
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
          <option value="female">Girls</option>
          <option value="male">Boys</option>
        </select>
        <select
          className={styles.select}
          value={filterAge}
          onChange={(e) => setFilterAge(e.target.value)}
        >
          <option value="all">All Ages</option>
          <option value="18s">18U</option>
          <option value="16s">16U</option>
          <option value="14s">14U</option>
          <option value="12s">12U</option>
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
        <div className={styles.sortToggle}>
          <button
            className={`${styles.sortBtn} ${sortBy === 'usta' ? styles.sortActive : ''}`}
            onClick={() => setSortBy('usta')}
          >
            USTA
          </button>
          <button
            className={`${styles.sortBtn} ${sortBy === 'utr' ? styles.sortActive : ''}`}
            onClick={() => setSortBy('utr')}
          >
            UTR
          </button>
          <button
            className={`${styles.sortBtn} ${sortBy === 'tr' ? styles.sortActive : ''}`}
            onClick={() => setSortBy('tr')}
          >
            TR
          </button>
        </div>
        <button className={styles.resetBtn} onClick={resetFilters}>
          Reset
        </button>
      </div>

      <div className={styles.resultsCount}>
        {filtered.length === 0
          ? 'No players found'
          : `Showing ${rangeStart}–${rangeEnd} of ${filtered.length} player${filtered.length !== 1 ? 's' : ''}${filtered.length !== players.length ? ` (filtered from ${players.length})` : ''}`}
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>
                {sortBy === 'utr'
                  ? 'UTR Rating'
                  : sortBy === 'tr'
                    ? 'TR Rank'
                    : 'USTA Rank'}
              </th>
              <th>Name</th>
              <th>Gender</th>
              <th>Age</th>
              <th>Class</th>
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
                <td className={styles.rankCell}>
                  {sortBy === 'utr'
                    ? (p.utr_rating ?? '—')
                    : sortBy === 'tr'
                      ? (p.tr_rank ?? '—')
                      : (p.usta_rank ?? '—')}
                </td>
                <td className={styles.nameCell}>{p.full_name}</td>
                <td>
                  {p.gender === 'male'
                    ? 'M'
                    : p.gender === 'female'
                      ? 'F'
                      : '—'}
                </td>
                <td>{formatAgeDivision(inferAgeDivision(p))}</td>
                <td>
                  {(() => {
                    const c = getClassInfo(p)
                    if (!c) return '—'
                    return (
                      <span
                        style={c.estimated ? { opacity: 0.55 } : undefined}
                        title={
                          c.estimated
                            ? 'Estimated from age division — no exact grad year on file'
                            : undefined
                        }
                      >
                        {c.short}
                      </span>
                    )
                  })()}
                </td>
                <td>{p.usta_state ?? p.tr_state ?? '—'}</td>
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
              <div className={styles.modalHeaderLeft}>
                {selected.image_url ? (
                  <img
                    src={selected.image_url}
                    alt={selected.full_name}
                    className={styles.modalAvatar}
                  />
                ) : (
                  <div className={styles.modalAvatarFallback}>
                    {selected.first_name?.[0] ?? selected.full_name?.[0] ?? '?'}
                  </div>
                )}
                <div>
                  <h3 className={styles.modalName}>{selected.full_name}</h3>
                  <div className={styles.modalMeta}>
                    {selected.gender === 'male' ? 'Boys' : 'Girls'}
                    {selected.usta_age_division
                      ? ` · ${formatAgeDivision(selected.usta_age_division)}`
                      : ''}
                    {(() => {
                      const c = getClassInfo(selected)
                      return c
                        ? ` · Class of ${c.full}${c.estimated ? ' (est.)' : ''}`
                        : ''
                    })()}
                    {selected.country_code ? ` · ${selected.country_code}` : ''}
                  </div>
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
                      value={formatAgeDivision(selected.usta_age_division)}
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

              {/* TennisRecruiting */}
              {selected.tr_rank != null && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Tennis Recruiting</div>
                  <div className={styles.grid}>
                    <Stat
                      label="TR Rank"
                      value={
                        selected.tr_rank != null ? `#${selected.tr_rank}` : null
                      }
                    />
                    <Stat label="Stars" value={selected.tr_stars} />
                    <Stat label="Committed" value={selected.tr_committed_to} />
                    <Stat label="High School" value={selected.tr_high_school} />
                    <Stat label="State" value={selected.tr_state} />
                    <Stat label="City" value={selected.tr_city} />
                  </div>
                </div>
              )}

              {/* Player info */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Player Info</div>
                <div className={styles.grid}>
                  <Stat
                    label="Grad Year"
                    value={(() => {
                      const c = getClassInfo(selected)
                      return c
                        ? `${c.full}${c.estimated ? ' (est.)' : ''}`
                        : null
                    })()}
                  />
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
