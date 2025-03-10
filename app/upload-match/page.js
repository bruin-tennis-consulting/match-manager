'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import { dataURItoBlob } from '@rjsf/utils'

import getTeams from '@/app/services/getTeams.js'
// import { initialSchema, uiSchema } from '@/app/services/matchSchemas.js'
import { searchableProperties } from '@/app/services/searchableProperties.js'

import { useData } from '@/app/DataProvider.js'
import { useAuth } from '@/app/AuthWrapper.js'

import styles from '@/app/styles/Upload.module.css'

import {
  initialSchema,
  uiSchema as baseUiSchema
} from '@/app/services/matchSchemas.js'

export default function UploadMatchForm() {
  const { createMatch } = useData() // Use the createMatch hook
  const [schema, setSchema] = useState(initialSchema)
  const [teams, setTeams] = useState([])
  const [collections, setCollections] = useState([])
  const [formData, setFormData] = useState({})
  const [errors, setErrors] = useState([])

  const [localUiSchema, setLocalUiSchema] = useState(baseUiSchema) // local uiSchema state to update the event field dynamically

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

    // Update the event field's disabled state: if duel is not true, disable event.
    setLocalUiSchema({
      ...baseUiSchema,
      event: {
        'ui:disabled': !newFormData.duel
      }
    })
  }

  const validateFileType = (file, expectedType, fieldName) => {
    if (file && file.split(';')[0].split(':')[1] !== expectedType) {
      throw new Error(
        `Invalid file type for ${fieldName}. Please upload a ${expectedType.split('/')[1]} file.`
      )
    }
  }

  const handleSubmit = async ({ formData }) => {
    try {
      let published = true
      if (
        !formData.opponentPlayer ||
        formData.opponentPlayer.trim().split(/\s+/).length < 2
      ) {
        throw new Error(
          'Opponent player must include both first and last name.'
        )
      }
      // Validate the File types
      validateFileType(formData.jsonFile, 'application/json', 'JSON file')
      validateFileType(formData.pdfFile, 'application/pdf', 'PDF file')
      const pointsJson = formData.jsonFile
        ? JSON.parse(atob(formData.jsonFile.split(',')[1]))
        : []
      if (pointsJson.length === 0) {
        const result = confirm(
          "You're currently uploading an UNTAGGED match. Proceed?"
        )
        if (!result) throw new Error('Upload cancelled by user.')
        published = false
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
        surface: formData.surface || null,
        unfinished: formData.unfinished || false,
        duel: formData.duel || false
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
        pdfFile: formData.pdfFile ? dataURItoBlob(formData.pdfFile) : null,
        teams,
        players,
        matchDate: formData.date,
        singles: formData.singlesDoubles === 'Singles',
        matchDetails,
        searchableProperties,
        version: 'v1', // Current version for new matches added
        published
      })
      setErrors([])
      alert('Match uploaded successfully!')
    } catch (error) {
      console.error('Error uploading match:', error)
      setErrors([`Error: ${error.message}`])
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
          uiSchema={localUiSchema} // Changed to use out state variable
          formData={formData}
          onChange={handleChange}
          onSubmit={handleSubmit}
          validator={validator}
        />
        {errors.length > 0 && (
          <div className={styles.errorContainer}>
            {errors.map((error, index) => (
              <div key={index} className={styles.errorMessage}>
                <span className={styles.errorIcon}>⚠️</span>
                {error}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
