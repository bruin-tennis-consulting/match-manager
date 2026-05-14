'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import { dataURItoBlob } from '@rjsf/utils'
import ReactSelect from 'react-select'

import getTeams from '@/app/services/getTeams.js'
import { searchableProperties } from '@/app/services/searchableProperties.js'

import { useData } from '@/app/DataProvider.js'
import { useAuth } from '@/app/AuthWrapper.js'

import styles from '@/app/styles/Upload.module.css'

import {
  initialSchema,
  uiSchema as baseUiSchema
} from '@/app/services/matchSchemas.js'

/** SelectWidget wrapping react-select for enum fields. Replaces native <select>. */
function ReactSelectWidget({
  id,
  value,
  options = {},
  required,
  disabled,
  readonly,
  multiple = false,
  onChange,
  placeholder = 'Select...'
}) {
  const { enumOptions = [] } = options
  const opts = Array.isArray(enumOptions) ? enumOptions : []

  const getSelectValue = () => {
    if (multiple) {
      const arr = Array.isArray(value) ? value : value != null ? [value] : []
      return arr.map((v) => opts.find((o) => o.value === v)).filter(Boolean)
    }
    if (value == null || value === '') return null
    return opts.find((o) => o.value === value) ?? null
  }

  const handleChange = (selected) => {
    if (multiple) {
      const arr = Array.isArray(selected) ? selected : []
      onChange(arr.map((o) => o.value))
    } else {
      onChange(selected ? selected.value : undefined)
    }
  }

  return (
    <ReactSelect
      inputId={id}
      value={getSelectValue()}
      options={opts}
      onChange={handleChange}
      isMulti={multiple}
      isDisabled={disabled || readonly}
      isClearable={!required}
      placeholder={placeholder}
      classNamePrefix="rjsf-select"
      menuPosition="fixed"
    />
  )
}

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
  const [mounted, setMounted] = useState(false)

  const { userProfile } = useAuth()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fetchCollectionsAndTeams = async () => {
      try {
        const allTeams = await getTeams()

        const uclaTeams = allTeams.filter(
          // Dropdown for only UCLA teams (filter)
          (team) =>
            team.name.includes('University of California, Los Angeles') &&
            (team.name.endsWith('(M)') || team.name.endsWith('(W)'))
        )

        setTeams(allTeams)
        const teamNames = allTeams.map((team) => team.name)
        const uclaNames = uclaTeams.map((team) => team.name)

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
              enum: uclaNames
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
      validateFileType(formData.htmlFile, 'text/html', 'HTML file')

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
        htmlFile: formData.htmlFile ? dataURItoBlob(formData.htmlFile) : null,
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

  if (!mounted) {
    return (
      <div className={styles.container}>
        <div>
          <h1 className={styles.title}>Upload Match</h1>
          <h3>
            Make sure you add the player in &apos;Upload Team&apos; before this!
          </h3>
          <p style={{ marginTop: '1rem', color: '#666' }}>Loading form...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div>
        <h1 className={styles.title}>Upload Match</h1>
        <h3>
          Make sure you add the player in &apos;Upload Team&apos; before this!
        </h3>

        <Form
          className={styles.form}
          schema={schema}
          uiSchema={localUiSchema}
          formData={formData}
          onChange={handleChange}
          onSubmit={handleSubmit}
          validator={validator}
          disabled={isUploading}
          widgets={{ SelectWidget: ReactSelectWidget }}
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
