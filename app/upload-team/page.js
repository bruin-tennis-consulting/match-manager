'use client'
import React, { useState, useEffect, useMemo } from 'react'
import { uploadTeam, uploadPlayer } from '@/app/services/upload.js'
import getTeams from '@/app/services/getTeams.js'
import styles from '@/app/styles/Upload.module.css'
export default function UploadVideo() {
  const [teamName, setTeamName] = useState('')
  const [teamSelect, setTeamSelect] = useState('Arizona (M)')
  const [playerClass, setPlayerClass] = useState('Freshman')
  const [playerFirstName, setPlayerFirstName] = useState('')
  const [playerLastName, setPlayerLastName] = useState('')
  const [playerHand, setPlayerHand] = useState('right')
  const [playerAge, setPlayerAge] = useState('')
  const [playerPhoto, setPlayerPhoto] = useState(null)
  const [logoFile, setLogoFile] = useState(null)
  const [teams, setTeams] = useState([])
  const [playerLargePhoto, setPlayerLargePhoto] = useState(null)
  const [playerHeightFeet, setPlayerHeightFeet] = useState('')
  const [playerHeightInches, setPlayerHeightInches] = useState('')
  const [playerBio, setPlayerBio] = useState('')
  const [teamError, setTeamError] = useState([])

  // prevents re-rendering of teams on other state change (useful when teams is expensive)
  // const memoizedTeams = useMemo(() => teams, [teams]);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const allTeams = await getTeams()
        setTeams(allTeams)
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    fetchTeams()
  }, [])

  const handleUploadSubmit = async (e) => {
    e.preventDefault()

    const teamExists = teams.some(
      (team) => team.name.toLowerCase() === teamName.trim().toLowerCase()
    )

    if (!teamName || !logoFile) {
      setTeamError('Please fill in all fields.')
      return
    }

    if (teamExists) {
      setTeamError(
        `Team "${teamName}" already exists. Please use a different name.`
      )
      return
    }

    if (!teamName || !logoFile) {
      setTeamError('Please fill in all fields.')
      return
    }

    try {
      await uploadTeam(teamName, logoFile)
      setTeamError('') // clear error
      alert('done!')
    } catch (error) {
      console.error('Error uploading match:', error)
    }
  }

  const handleAddSubmit = async (e) => {
    e.preventDefault()

    if (!playerFirstName || !playerLastName || !teamSelect) {
      console.error('Please fill in Player Name.')
      return
    }
    const playerHeight = `${playerHeightFeet}'${playerHeightInches}`

    try {
      await uploadPlayer(
        playerFirstName,
        playerLastName,
        teamSelect,
        playerHand,
        playerBio,
        playerHeight,
        playerAge,
        playerClass,
        playerLargePhoto,
        playerPhoto
      )
      alert('done!')
    } catch (error) {
      console.error('Error uploading match:', error)
    }
  }

  const teamOptions = useMemo(() => {
    return teams.map((option, index) => (
      <option key={index} value={option.name}>
        {option.name}
      </option>
    ))
  }, [teams])

  const classOptions = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate']

  return (
    <div className={styles.container}>
      <div>
        <h1 className={styles.title}>Current Teams</h1>
        <ul>
          {teams.map((team, index) => (
            <li key={index} value={team.name}>
              {team.name}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h1 className={styles.title}>Add Team</h1>
        {teamError && <p style={{ color: 'red' }}>{teamError}</p>}
        <form className={styles.form} onSubmit={handleUploadSubmit}>
          <label>
            Team Name:
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </label>
          <label>
            Logo File (png or jpg):
            <input
              type="file"
              accept="image/png, image/jpeg"
              onChange={(e) => setLogoFile(e.target.files[0])}
            />
          </label>
          <button type="submit">Upload</button>
        </form>
      </div>
      <div>
        <h1 className={styles.title}>Add Player</h1>
        <h3>
          See added players by selecting the team in &apos;Upload Match&apos;
        </h3>
        <form className={styles.form} onSubmit={handleAddSubmit}>
          <label>
            First Name:
            <input
              type="text"
              value={playerFirstName}
              onChange={(e) => setPlayerFirstName(e.target.value)}
            />
          </label>
          <label>
            Last Name:
            <input
              type="text"
              value={playerLastName}
              onChange={(e) => setPlayerLastName(e.target.value)}
            />
          </label>
          <label>
            {' '}
            Hand:
            <input
              type="radio"
              checked={playerHand === 'right'}
              onChange={() => {
                setPlayerHand('right')
              }}
            />{' '}
            Right
            <input
              type="radio"
              checked={playerHand === 'left'}
              onChange={() => {
                setPlayerHand('left')
              }}
            />{' '}
            Left
            <input
              type="radio"
              checked={playerHand === 'ambidextrous'}
              onChange={() => {
                setPlayerHand('ambidextrous')
              }}
            />{' '}
            Ambidextrous
          </label>
          <label>
            Team:
            <select id="search" onChange={(e) => setTeamSelect(e.target.value)}>
              {teamOptions}
            </select>
          </label>
          <label>
            Age:
            <input
              type="number"
              value={playerAge}
              onChange={(e) => setPlayerAge(e.target.value)}
            />
          </label>
          <label>
            Class:
            <select
              id="search"
              onChange={(e) => setPlayerClass(e.target.value)}
            >
              {classOptions.map((option, index) => (
                <option key={index} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Height:
            <input
              type="number"
              min="0"
              value={playerHeightFeet}
              onChange={(e) => setPlayerHeightFeet(e.target.value)}
            />
            &nbsp;&apos;
            <input
              type="number"
              min="0"
              max="11"
              value={playerHeightInches}
              onChange={(e) => setPlayerHeightInches(e.target.value)}
            />
          </label>
          <label>
            Player Head Photo (webp, svg, png, jpg):
            <input
              type="file"
              accept="image/webp, image/svg+xml, image/png, image/jpeg"
              onChange={(e) => setPlayerPhoto(e.target.files[0])}
            />
          </label>
          <label>
            Large Player Photo (webp, svg, png, jpg):
            <input
              type="file"
              accept="image/webp, image/svg+xml, image/png, image/jpeg"
              onChange={(e) => setPlayerLargePhoto(e.target.files[0])}
            />
          </label>
          Bio:
          <label>
            <textarea
              value={playerBio}
              onChange={(e) => setPlayerBio(e.target.value)}
              rows="4"
              cols="50"
            />
          </label>
          <button type="submit">Add</button>
        </form>
      </div>
    </div>
  )
}
