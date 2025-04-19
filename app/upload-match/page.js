'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import { dataURItoBlob } from '@rjsf/utils'

import getTeams from '@/app/services/getTeams.js'
import { searchableProperties } from '@/app/services/searchableProperties.js'

import { useData } from '@/app/DataProvider.js'
import { useAuth } from '@/app/AuthWrapper.js'

import styles from '@/app/styles/Upload.module.css'

import {
  initialSchema,
  uiSchema as baseUiSchema
} from '@/app/services/matchSchemas.js'

export default function UploadMatchForm() {
  const setCollections = useState([])[1]

  const { createMatch } = useData()
  const [schema, setSchema] = useState(initialSchema)
  const [teams, setTeams] = useState([])
  const [formData, setFormData] = useState({})
  const [errors, setErrors] = useState([])
  const [successMessage, setSuccessMessage] = useState('')
  const [localUiSchema, setLocalUiSchema] = useState(baseUiSchema)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)

  const { userProfile } = useAuth()

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
  }, [userProfile, setCollections])

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
    (newFormData) => {
      const clientPlayers = getPlayersForTeam(newFormData.clientTeam)
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
    if (newFormData.clientTeam) {
      updatePlayerOptions(newFormData)
    }

    // Update the event field's disabled state: if duel is not true, disable event.
    setLocalUiSchema((prevUiSchema) => ({
      ...prevUiSchema,
      event: {
        'ui:disabled': !newFormData.duel
      }
    }))
  }

  const validateFileType = (file, expectedType, fieldName) => {
    if (file && file.split(';')[0].split(':')[1] !== expectedType) {
      throw new Error(
        `Invalid file type for ${fieldName}. Please upload a ${expectedType.split('/')[1]} file.`
      )
    }
  }

  // Memoize the progress bar styles to avoid unnecessary recalculations
  const progressBarStyles = useMemo(
    () => ({
      progressContainer: {
        width: '100%',
        backgroundColor: '#e0e0e0',
        borderRadius: '4px',
        marginTop: '20px',
        marginBottom: '20px',
        height: '20px',
        position: 'relative',
        overflow: 'hidden'
      },
      progressBar: {
        height: '100%',
        width: `${uploadProgress}%`,
        backgroundColor: '#4CAF50',
        borderRadius: '4px',
        transition: 'width 0.3s ease'
      },
      progressText: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: uploadProgress > 50 ? 'white' : 'black',
        fontWeight: 'bold'
      }
    }),
    [uploadProgress]
  )

  const simulateProgress = useCallback(() => {
    setUploadProgress(0)
    const timer = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(timer)
          return prev
        }
        return prev + 10
      })
    }, 500)
    return timer
  }, [])

  const handleSubmit = async ({ formData }) => {
    try {
      setIsUploading(true)
      setErrors([])

      // Start progress simulation
      const progressTimer = simulateProgress()

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
        if (!result) {
          clearInterval(progressTimer)
          setIsUploading(false)
          setUploadProgress(0)
          throw new Error('Upload cancelled by user.')
        }
        published = false
      }

      // Parse player names once
      const clientNameParts = formData.clientPlayer.split(' ')
      const opponentNameParts = formData.opponentPlayer.split(' ')

      const teamsData = {
        clientTeam: formData.clientTeam,
        opponentTeam: formData.opponentTeam
      }

      const players = {
        client: {
          firstName: clientNameParts[0],
          lastName: clientNameParts[1],
          UTR: formData.clientUTR || null
        },
        opponent: {
          firstName: opponentNameParts[0],
          lastName: opponentNameParts[1],
          UTR: formData.opponentUTR || null
        }
      }

      // Prepare weather data once
      const weatherValue = formData.weather || []
      const weather = {
        temperature: formData.temperature || null,
        cloudy: weatherValue.includes('Cloudy'),
        windy: weatherValue.includes('Windy')
      }

      const matchDetails = {
        weather: weather || null,
        division: formData.division || null,
        event: formData.event || null,
        lineup: formData.lineup || null,
        matchVenue: formData.matchVenue || null,
        round: formData.round || null,
        indoor: formData.court === 'Indoor',
        surface: formData.surface || null,
        unfinished: formData.unfinished || false,
        duel: formData.duel || false
      }

      const sets = [
        formData.matchScore.set1,
        formData.matchScore.set2,
        formData.matchScore.set3 || {}
      ]

      await createMatch(formData.collection, {
        sets,
        videoId: formData.videoID,
        pointsJson,
        pdfFile: formData.pdfFile ? dataURItoBlob(formData.pdfFile) : null,
        teams: teamsData,
        players,
        matchDate: formData.date,
        singles: formData.singlesDoubles === 'Singles',
        matchDetails,
        searchableProperties,
        version: 'v1',
        published
      })

      // Complete progress and show success message
      setUploadProgress(100)
      clearInterval(progressTimer)
      setTimeout(() => {
        setIsUploading(false)
        setUploadProgress(0)
        setSuccessMessage('Match uploaded successfully!')
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccessMessage('')
        }, 5000)
      }, 500)
    } catch (error) {
      console.error('Error uploading match:', error)
      setErrors([`Error: ${error.message}`])
      setIsUploading(false)
      setUploadProgress(0)
      setSuccessMessage('')
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
          schema={schema}
          uiSchema={localUiSchema}
          formData={formData}
          onChange={handleChange}
          onSubmit={handleSubmit}
          validator={validator}
          disabled={isUploading}
        />

        {isUploading && (
          <div style={progressBarStyles.progressContainer}>
            <div style={progressBarStyles.progressBar}></div>
            <div style={progressBarStyles.progressText}>{uploadProgress}%</div>
          </div>
        )}

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

        {successMessage && (
          <div className={styles.successContainer}>
            <div className={styles.successMessage}>
              <span className={styles.successIcon}>✓</span>
              {successMessage}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
