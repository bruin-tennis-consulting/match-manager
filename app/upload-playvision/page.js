'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'

import getTeams from '@/app/services/getTeams.js'
import { searchableProperties } from '@/app/services/searchableProperties.js'

import { useData } from '@/app/DataProvider.js'
import { useAuth } from '@/app/AuthWrapper.js'

import styles from '@/app/styles/Upload.module.css'

import {
  initialSchema,
  uiSchema as baseUiSchema
} from '@/app/services/playvisionSchemas.js'

export default function UploadMatchForm() {
  const setCollections = useState([])[1]

  const { createMatch } = useData()
  const [schema, setSchema] = useState(initialSchema)
  const [teams, setTeams] = useState([])
  const [formData, setFormData] = useState({})
  const [errors, setErrors] = useState([])
  const localUiSchema = baseUiSchema
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)

  const { userProfile } = useAuth()

  useEffect(() => {
    const fetchCollectionsAndTeams = async () => {
      try {
        const allTeams = await getTeams()
        setTeams(allTeams)
        const teamNames = allTeams.map((team) => team.name)

        const userCollections = userProfile?.collections || []
        setCollections(userCollections)

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
  }

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

      const progressTimer = simulateProgress()

      if (
        !formData.opponentPlayer ||
        formData.opponentPlayer.trim().split(/\s+/).length < 2
      ) {
        throw new Error(
          'Opponent player must include both first and last name.'
        )
      }

      const clientNameParts = formData.clientPlayer.split(' ')
      const opponentNameParts = formData.opponentPlayer.split(' ')

      await createMatch('playvision', {
        teams: {
          clientTeam: formData.clientTeam,
          opponentTeam: formData.opponentTeam
        },
        players: {
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
        },
        matchDate: formData.date,
        stats: formData.stats || {},
        shotStats: formData.shotStats || {},
        alreadyUploaded: formData.alreadyUploaded || false,
        searchableProperties,
        version: 'v1',
        published: true
      })

      setUploadProgress(100)
      clearInterval(progressTimer)
      setTimeout(() => {
        setIsUploading(false)
        setUploadProgress(0)
        alert('Match uploaded successfully!')
      }, 500)
    } catch (error) {
      console.error('Error uploading match:', error)
      setErrors([`Error: ${error.message}`])
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className={styles.container}>
      <div>
        <h1 className={styles.title}>Upload PlayVision Match Data</h1>
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
      </div>
    </div>
  )
}
