'use client'

import React from 'react'
import Link from 'next/link'
import { useMatchData } from '../../components/MatchDataProvider' // Assuming the hook is located in the context folder

export default function MatchList() {
  const { matches, updateMatch, refresh } = useMatchData()
  const [newName, setNewName] = useState('')

  const handleDelete = async (id) => {
    try {
      await updateMatch(id, { _deleted: true }) // Mark the match as deleted
      refresh() // Refresh match data after deletion
    } catch (error) {
      console.error('Error deleting match:', error)
    }
  }

  const handleDownload = (points, matchId) => {
    const jsonString = JSON.stringify(points, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${matchId}_points.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // const handleRename = async (id) => {
  //   try {
  //     await updateMatch(id, { name: newName })
  //   } catch (error) {
  //     console.error('Error renaming match:', error)
  //   }
  // }

  return (
    <div>
      <h1>Match List</h1>
      {formattedMatches.length > 0 ? (
        <ul>
          {formattedMatches.map((match) => {
            const name = `${match.players.client.firstName} ${match.players.client.lastName} ${match.teams.clientTeam} vs. ${match.players.opponent.firstName} ${match.players.opponent.lastName} ${match.teams.opponentTeam} [${match.id}] `
            return (
              <div key={match.id}>
                <li>
                  <span>
                    {name}
                    <button onClick={() => handleDelete(match.id)}>
                      Delete
                    </button>
                  </span>
                  <span>
                    <button
                      onClick={() => handleDownload(match.pointsJson, match.id)}
                    >
                      Download JSON
                    </button>
                  </span>
                  <br />
                  <Link href={`/tag-match/${match.id}`}>
                    <button>Tag Match - Full</button>
                  </Link>
                  <Link href={`/timestamp-tagger?videoId=${match.videoId}`}>
                    <button>Tag Match - Timestamp</button>
                  </Link>
                  {/* <br />
                  <input onChange={(e) => setNewName(e.target.value)} />
                  <button onClick={() => handleRename(match.id)}>Rename</button> */}
                </li>
              </div>
            )
          })}
        </ul>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  )
}
