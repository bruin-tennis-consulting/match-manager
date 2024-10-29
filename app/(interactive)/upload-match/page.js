'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import { useMatchData } from '../../components/MatchDataProvider.js'
import { useAuth } from '../../components/AuthWrapper.js'
import getTeams from '@/app/services/getTeams.js'
import styles from '../../styles/Upload.module.css'
import { initialSchema, uiSchema } from '@/app/services/matchSchemas.js'
import { searchableProperties } from '@/app/services/searchableProperties.js'

export default function UploadMatchForm() {
  const { createMatch } = useMatchData() // Use the createMatch hook
  const [schema, setSchema] = useState(initialSchema)
  const [teams, setTeams] = useState([])
  const [collections, setCollections] = useState([])
  const [formData, setFormData] = useState({})

  const { userProfile } = useAuth()

  // TODO: remove this line used for linting
  console.log(collections)

  useEffect(() => {
    const fetchCollectionsAndTeams = async () => {
      try {
        const allTeams = await getTeams()
        setTeams(allTeams)
        const teamNames = allTeams.map((team) => team.name)

        // Assuming userProfile.collections contains the collection names
        const userCollections = userProfile?.collections || []

        setCollections(userCollections)

        // Update schema with team and collection names
        setSchema((prevSchema) => ({
          ...prevSchema,
          properties: {
            ...prevSchema.properties,
            clientTeam: {
              ...prevSchema.properties.clientTeam,
              enum: teamNames
            },
            opponentTeam: {
              ...prevSchema.properties.opponentTeam,
              enum: teamNames
            },
            collection: {
              ...prevSchema.properties.collection,
              enum: userCollections
            }
          }
        }))
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    fetchCollectionsAndTeams()
  }, [])

  const getPlayersForTeam = useCallback(
    (teamName) => {
      const selectedTeam = teams.find((team) => team.name === teamName)
      return (
        selectedTeam?.players?.map(
          (player) => `${player.firstName} ${player.lastName}`
        ) || []
      )
    },
    [teams]
  )

  const updatePlayerOptions = useCallback(
    (formData) => {
      const clientPlayers = getPlayersForTeam(formData.clientTeam)

      setSchema((prevSchema) => ({
        ...prevSchema,
        properties: {
          ...prevSchema.properties,
          clientPlayer: {
            ...prevSchema.properties.clientPlayer,
            enum: clientPlayers
          }
        }
      }))
    },

    [getPlayersForTeam]
  )
  const handleChange = ({ formData: newFormData }) => {
    setFormData(newFormData)
    updatePlayerOptions(newFormData)
  }

  const handleSubmit = async ({ formData }) => {
    try {
      const pointsJson = formData.jsonFile
        ? JSON.parse(atob(formData.jsonFile.split(',')[1]))
        : []
      if (pointsJson.length === 0) {
        const result = confirm(
          "You're currently uploading an UNTAGGED match. Proceed?"
        )
        if (!result) throw new Error('Upload cancelled by user.')
      }
      const teams = {
        clientTeam: formData.clientTeam,
        opponentTeam: formData.opponentTeam
      }
      const players = {
        client: {
          firstName: formData.clientPlayer.split(' ')[0],
          lastName: formData.clientPlayer.split(' ')[1],
          UTR: formData.clientUTR || null
        },
        opponent: {
          firstName: formData.opponentPlayer.split(' ')[0],
          lastName: formData.opponentPlayer.split(' ')[1],
          UTR: formData.opponentUTR || null
        }
      }
      const weather = {
        temperature: formData.temperature || null,
        cloudy: formData.weather ? formData.weather.includes('Cloudy') : null,
        windy: formData.weather ? formData.weather.includes('Windy') : null
      }
      const matchDetails = {
        weather: weather || null,
        division: formData.division || null,
        event: formData.event || null,
        lineup: formData.lineup || null,
        matchVenue: formData.matchVenue || null,
        round: formData.round || null,
        indoor: formData.court ? formData.court === 'Indoor' : null,
        surface: formData.surface || null
      }
      // const sets = parseMatchScore(formData.matchScore);
      const sets = [
        formData.matchScore.set1,
        formData.matchScore.set2,
        formData.matchScore.set3 || {}
      ]

      // Use the createMatch hook to upload the match
      await createMatch(formData.collection, {
        sets,
        videoId: formData.videoID,
        pointsJson,
        pdfFile: formData.pdfFile || null,
        teams,
        players,
        matchDate: formData.date,
        singles: formData.singlesDoubles === 'Singles',
        matchDetails,
        searchableProperties,
        version: 'v1', // Current version for new matches added
        published: true
      })

      alert('Match uploaded successfully!')
    } catch (error) {
      console.error('Error uploading match:', error)
      alert(`Error uploading match: ${error.message}`)
    }
  }

  return (
    <div className={styles.container}>
      <div>
        <h1 className={styles.title}>Upload Match</h1>
        <h3>
          Make sure you add the player in &apos;Upload Team&apos; before this!
        </h3>
        <Form
          key={JSON.stringify(schema)}
          schema={schema}
          uiSchema={uiSchema}
          formData={formData}
          onChange={handleChange}
          onSubmit={handleSubmit}
          validator={validator}
        />
      </div>
    </div>
  )
}
