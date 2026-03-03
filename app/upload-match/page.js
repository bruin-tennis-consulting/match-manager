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
      if (formData.jsonFile) {
        validateFileType(formData.jsonFile, 'application/json', 'JSON file')
      }
      
      // PDF/HTML file is optional if CSV is provided
      if (formData.pdfFile && !formData.csvFile) {
        // Only validate if no CSV is provided (CSV will generate HTML)
        const pdfMimeType = formData.pdfFile.split(';')[0].split(':')[1]
        if (pdfMimeType !== 'application/pdf' && pdfMimeType !== 'text/html') {
          throw new Error('PDF/HTML file must be a PDF or HTML file.')
        }
      }
      
      // Process CSV file if provided
      let generatedHtmlFile = formData.pdfFile
      if (formData.csvFile) {
        setUploadProgress(20) // Update progress
        
        try {
          // Extract CSV file from data URL
          const csvDataUrl = formData.csvFile
          let csvBlob = dataURItoBlob(csvDataUrl)
          
          // Ensure we have a valid Blob
          if (!(csvBlob instanceof Blob)) {
            // Fallback: manually convert data URL to Blob
            const response = await fetch(csvDataUrl)
            csvBlob = await response.blob()
          }
          
          // Create a File object from the Blob (required for FormData.append with filename)
          const csvFile = csvBlob instanceof File 
            ? csvBlob 
            : new File([csvBlob], 'match-data.csv', { type: 'text/csv' })
          
          // Create FormData to send to API
          const apiFormData = new FormData()
          apiFormData.append('csvFile', csvFile)
          
          // Add player names if available (they'll be extracted from CSV if not provided)
          if (formData.clientPlayer && formData.opponentPlayer) {
            apiFormData.append('player1Name', formData.clientPlayer)
            apiFormData.append('player2Name', formData.opponentPlayer)
          }
          
          // Call API to process CSV and generate HTML
          const response = await fetch('/api/process-csv', {
            method: 'POST',
            body: apiFormData
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            // Include detailed error information in the error message
            let errorMessage = errorData.error || 'Failed to process CSV file'
            
            // Add all available error details
            if (errorData.details) {
              errorMessage += `\n\nDetails:\n${errorData.details}`
            }
            if (errorData.pythonCommand) {
              errorMessage += `\n\nPython Command: ${errorData.pythonCommand}`
            }
            if (errorData.pythonScriptPath) {
              errorMessage += `\nPython Script: ${errorData.pythonScriptPath}`
            }
            if (errorData.stderr) {
              const stderrPreview = errorData.stderr.length > 500 
                ? errorData.stderr.substring(0, 500) + '...' 
                : errorData.stderr
              errorMessage += `\n\nPython Error Output:\n${stderrPreview}`
            }
            if (errorData.stdout) {
              const stdoutPreview = errorData.stdout.length > 500 
                ? errorData.stdout.substring(0, 500) + '...' 
                : errorData.stdout
              errorMessage += `\n\nPython Output:\n${stdoutPreview}`
            }
            if (errorData.suggestion) {
              errorMessage += `\n\nSuggestion: ${errorData.suggestion}`
            }
            
            console.error('CSV Processing Error Details:', errorData)
            throw new Error(errorMessage)
          }
          
          const result = await response.json()
          
          if (!result.success || !result.html) {
            throw new Error('Failed to generate HTML from CSV')
          }
          
          // Log success
          console.log('✓ CSV processed successfully!')
          console.log(`✓ HTML generated (${result.html.length} characters)`)
          console.log(`✓ Players: ${result.player1} vs ${result.player2}`)
          
          // Store HTML string directly - we'll create blob when uploading
          generatedHtmlFile = result.html
          
          setUploadProgress(50) // Update progress
        } catch (error) {
          console.error('Error processing CSV:', error)
          throw new Error(`CSV processing failed: ${error.message}`)
        }
      }

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

      // Log what's being uploaded
      let pdfFileToUpload = null
      if (generatedHtmlFile) {
        console.log('✓ Uploading match with generated HTML file')
        
        // Check if generatedHtmlFile is a string (from CSV) or data URL (from manual upload)
        let htmlBlob
        if (typeof generatedHtmlFile === 'string' && generatedHtmlFile.startsWith('data:')) {
          // It's a data URL (from manual upload)
          htmlBlob = dataURItoBlob(generatedHtmlFile)
        } else if (typeof generatedHtmlFile === 'string') {
          // It's an HTML string (from CSV processing)
          htmlBlob = new Blob([generatedHtmlFile], { type: 'text/html' })
        } else {
          throw new Error('Unexpected HTML file format')
        }
        
        console.log(`✓ HTML file size: ${(htmlBlob.size / 1024).toFixed(2)} KB`)
        console.log(`✓ HTML blob type: ${htmlBlob.type}`)
        
        // Create file object with name for Firebase Storage
        const player1Name = formData.clientPlayer?.replace(/\s+/g, '_') || 'Player1'
        const player2Name = formData.opponentPlayer?.replace(/\s+/g, '_') || 'Player2'
        const fileName = `${player1Name}_vs_${player2Name}_visualizations.html`
        pdfFileToUpload = {
          blob: htmlBlob,
          name: fileName
        }
      } else if (formData.pdfFile) {
        // Use provided PDF/HTML file
        // Extract filename from data URL or use default
        const player1Name = formData.clientPlayer?.replace(/\s+/g, '_') || 'Player1'
        const player2Name = formData.opponentPlayer?.replace(/\s+/g, '_') || 'Player2'
        const defaultFileName = `${player1Name}_vs_${player2Name}_visualization.html`
        pdfFileToUpload = {
          blob: dataURItoBlob(formData.pdfFile),
          name: defaultFileName
        }
      } else {
        console.log('ℹ No HTML/PDF file to upload')
      }

      await createMatch(formData.collection, {
        sets,
        videoId: formData.videoID,
        pointsJson,
        pdfFile: pdfFileToUpload,
        teams: teamsData,
        players,
        matchDate: formData.date,
        singles: formData.singlesDoubles === 'Singles',
        matchDetails,
        searchableProperties,
        version: 'v1',
        published
      })
      
      console.log('✓ Match uploaded successfully to database')

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
