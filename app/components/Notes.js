'use client'

import React, { useState } from 'react'
import styles from '../styles/Notes.module.css'

function Notes({
  videoId,
  videoObject,
  pointsJson,
  authUser,
  matchData,
  onNoteSaved,
  updateMatch,
  matchId,
  matchCollection
}) {
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [showNotesList, setShowNotesList] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [currentTimestamp, setCurrentTimestamp] = useState(null)
  const [nearestPoint, setNearestPoint] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleGoToNearestTimestamp = () => {
    const currentPointsJson = matchData?.pointsJson || pointsJson || []
    if (!videoObject) {
      return
    }

    // Untagged match: anchor note to current YouTube time only (no score / no points)
    if (!currentPointsJson || currentPointsJson.length === 0) {
      try {
        const t = Math.round(videoObject.getCurrentTime() * 1000)
        setCurrentTimestamp(t)
        setNearestPoint(null)
        setShowNoteInput(true)
      } catch (error) {
        console.error('Error reading video time for note:', error)
      }
      return
    }

    try {
      // Get current time in milliseconds
      const currentTime = Math.round(videoObject.getCurrentTime() * 1000)

      // Find the nearest point based on Position
      let nearest = null
      let minDistance = Infinity

      currentPointsJson.forEach((point) => {
        if (point.Position !== undefined && point.Position !== null) {
          const distance = Math.abs(point.Position - currentTime)
          if (distance < minDistance) {
            minDistance = distance
            nearest = point
          }
        }
      })

      if (nearest && nearest.Position !== undefined) {
        // Seek to the nearest point's timestamp (convert ms to seconds)
        videoObject.seekTo(nearest.Position / 1000, true)

        // Store the timestamp and point for the note
        setCurrentTimestamp(nearest.Position)
        setNearestPoint(nearest)
        setShowNoteInput(true)
      }
    } catch (error) {
      console.error('Error seeking to nearest timestamp:', error)
    }
  }

  const handleSaveNote = async () => {
    if (!noteText.trim() || currentTimestamp == null) {
      return
    }

    if (!updateMatch || !matchId) {
      console.error(
        'updateMatch or matchId not provided - cannot save to Firestore'
      )
      alert('Cannot save note: Missing match information')
      return
    }

    setIsSaving(true)
    try {
      const currentPointsJson = matchData?.pointsJson || pointsJson || []

      // Untagged: store on match as videoNotes
      if (!nearestPoint) {
        const existingVideoNotes = matchData?.videoNotes || []
        const newNote = {
          videoNote: true,
          userId: authUser?.uid || 'anonymous',
          timestamp: currentTimestamp,
          noteText: noteText.trim(),
          noteId: Date.now().toString(),
          createdAt: new Date().toISOString()
        }
        const nextVideoNotes = [...existingVideoNotes, newNote]
        await updateMatch(
          matchId,
          { videoNotes: nextVideoNotes },
          { skipRefetch: true, skipMatchesStateUpdate: true }
        )
        if (onNoteSaved) {
          onNoteSaved({
            ...matchData,
            videoNotes: nextVideoNotes
          })
        } else {
          console.error('onNoteSaved callback is not defined!')
        }
        setNoteText('')
        setShowNoteInput(false)
        setCurrentTimestamp(null)
        setNearestPoint(null)
        return
      }

      // Tagged: unchanged — attach to nearest point in pointsJson
      const updatedPointsJson = currentPointsJson.map((point) => {
        // Match the point by Position (timestamp) and Name to ensure we get the right one
        const isMatch =
          point.Position === nearestPoint.Position &&
          point.Name === nearestPoint.Name

        if (isMatch) {
          // Initialize notes array if it doesn't exist
          const existingNotes = point.notes || []

          // Create new note object
          const newNote = {
            userId: authUser?.uid || 'anonymous',
            timestamp: currentTimestamp,
            noteText: noteText.trim(),
            noteId: Date.now().toString(),
            createdAt: new Date().toISOString()
          }

          // Add new note to this point's notes array
          return {
            ...point,
            notes: [...existingNotes, newNote]
          }
        }
        return point
      })

      // Save to Firestore without triggering a global refetch or matches state change (local onNoteSaved handles UI)
      await updateMatch(
        matchId,
        { pointsJson: updatedPointsJson },
        { skipRefetch: true, skipMatchesStateUpdate: true }
      )

      // Update local state with updated pointsJson
      if (onNoteSaved) {
        onNoteSaved({
          ...matchData,
          pointsJson: updatedPointsJson
        })
      } else {
        console.error('onNoteSaved callback is not defined!')
      }

      // Reset form
      setNoteText('')
      setShowNoteInput(false)
      setCurrentTimestamp(null)
      setNearestPoint(null)
    } catch (error) {
      console.error('Error saving note:', error)
      alert('Error saving note: ' + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelNote = () => {
    setNoteText('')
    setShowNoteInput(false)
    setCurrentTimestamp(null)
    setNearestPoint(null)
  }

  const handleViewNotes = () => {
    setShowNotesList(!showNotesList)
  }

  const handleJumpToNote = (timestamp) => {
    if (videoObject && videoObject.seekTo) {
      videoObject.seekTo(timestamp / 1000, true)
    }
  }

  const handleDeleteNote = async (noteToDelete) => {
    if (!noteToDelete || !noteToDelete.noteId) {
      console.error('Invalid note data for deletion')
      return
    }

    if (!updateMatch || !matchId) {
      console.error(
        'updateMatch or matchId not provided - cannot delete from Firestore'
      )
      alert('Cannot delete note: Missing match information')
      return
    }

    if (!confirm('Are you sure you want to delete this note?')) {
      return
    }

    try {
      if (noteToDelete.videoNote) {
        const existing = matchData?.videoNotes || []
        const updatedVideoNotes = existing.filter(
          (n) => n.noteId !== noteToDelete.noteId
        )
        if (updatedVideoNotes.length === existing.length) {
          alert('Error: Could not find the note to delete')
          return
        }
        await updateMatch(
          matchId,
          { videoNotes: updatedVideoNotes },
          { skipRefetch: true, skipMatchesStateUpdate: true }
        )
        if (onNoteSaved) {
          onNoteSaved({
            ...matchData,
            videoNotes: updatedVideoNotes
          })
        }
        return
      }

      if (noteToDelete.pointPosition == null) {
        console.error('Invalid point note for deletion')
        return
      }

      const currentPointsJson = matchData?.pointsJson || pointsJson || []

      let pointFound = false
      let noteFound = false

      // Find and remove the note from the point's notes array
      const updatedPointsJson = currentPointsJson.map((point) => {
        // Match by both Position AND Name (same logic as save function)
        // Convert to numbers for type-safe comparison
        const pointPosition = Number(point.Position)
        const deletePosition = Number(noteToDelete.pointPosition)
        const isMatchingPoint =
          pointPosition === deletePosition &&
          point.Name === noteToDelete.pointName

        if (isMatchingPoint) {
          pointFound = true
          const existingNotes = point.notes || []

          // Check if note exists in this point
          const noteExists = existingNotes.some(
            (note) => note.noteId === noteToDelete.noteId
          )
          if (noteExists) {
            noteFound = true
          }

          // Filter out the note with matching noteId
          const updatedNotes = existingNotes.filter(
            (note) => note.noteId !== noteToDelete.noteId
          )

          // If no notes left, remove the notes field entirely, otherwise update it
          if (updatedNotes.length === 0) {
            const { notes, ...pointWithoutNotes } = point
            return pointWithoutNotes
          } else {
            return {
              ...point,
              notes: updatedNotes
            }
          }
        }
        return point
      })

      // Validate that we found the point and note
      if (!pointFound) {
        console.error('Point not found for deletion:', {
          pointPosition: noteToDelete.pointPosition,
          pointName: noteToDelete.pointName
        })
        alert('Error: Could not find the point associated with this note')
        return
      }

      if (!noteFound) {
        console.error('Note not found in point:', {
          noteId: noteToDelete.noteId,
          pointPosition: noteToDelete.pointPosition
        })
        alert('Error: Could not find the note to delete')
        return
      }

      // Verify the note was actually removed before saving
      const pointAfterUpdate = updatedPointsJson.find(
        (p) =>
          Number(p.Position) === Number(noteToDelete.pointPosition) &&
          p.Name === noteToDelete.pointName
      )
      const noteStillExists = pointAfterUpdate?.notes?.some(
        (n) => n.noteId === noteToDelete.noteId
      )

      if (noteStillExists) {
        console.error('Note still exists after deletion attempt!')
        alert('Error: Note was not removed. Please try again.')
        return
      }

      // Save to Firestore without triggering a global refetch or matches state change
      await updateMatch(
        matchId,
        { pointsJson: updatedPointsJson },
        { skipRefetch: true, skipMatchesStateUpdate: true }
      )

      // Update local state
      if (onNoteSaved) {
        onNoteSaved({
          ...matchData,
          pointsJson: updatedPointsJson
        })
      }
    } catch (error) {
      console.error('Error deleting note:', error)
      alert('Error deleting note: ' + error.message)
    }
  }

  const currentPointsJson = matchData?.pointsJson || pointsJson || []
  const savedNotes = []

  ;(matchData?.videoNotes || []).forEach((note) => {
    savedNotes.push({ ...note, videoNote: true })
  })

  currentPointsJson.forEach((point) => {
    if (point.notes && Array.isArray(point.notes) && point.notes.length > 0) {
      point.notes.forEach((note) => {
        savedNotes.push({
          ...note,
          pointName: point.Name,
          pointPosition: point.Position
        })
      })
    }
  })

  savedNotes.sort(
    (a, b) =>
      (a.timestamp ?? a.pointPosition ?? 0) -
      (b.timestamp ?? b.pointPosition ?? 0)
  )

  return (
    <div className={styles.notesContainer}>
      {!showNoteInput && !showNotesList ? (
        <div className={styles.notesButtonsRow}>
          <button
            type="button"
            className={styles.getVideoIdButton}
            onClick={handleGoToNearestTimestamp}
            disabled={!videoObject}
          >
            Add Note
          </button>
          <button
            type="button"
            className={styles.viewNotesButton}
            onClick={handleViewNotes}
            disabled={!savedNotes || savedNotes.length === 0}
          >
            View Notes ({savedNotes.length})
          </button>
        </div>
      ) : showNotesList ? (
        <div className={styles.notesListContainer}>
          <div className={styles.notesListHeader}>
            <h3>Saved Notes ({savedNotes.length})</h3>
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => setShowNotesList(false)}
            >
              Close
            </button>
          </div>
          {savedNotes.length === 0 ? (
            <p className={styles.noNotes}>No notes saved yet.</p>
          ) : (
            <div className={styles.notesList}>
              {savedNotes.map((note) => (
                <div key={note.noteId} className={styles.noteItem}>
                  <div className={styles.noteItemHeader}>
                    <div className={styles.noteHeaderInfo}>
                      <span className={styles.noteTimestamp}>
                        {(() => {
                          const totalSeconds = note.timestamp / 1000
                          const minutes = Math.floor(totalSeconds / 60)
                          const seconds = totalSeconds % 60
                          const secondsInt = Math.floor(seconds)
                          const secondsDec = (seconds % 1)
                            .toFixed(2)
                            .substring(1)
                          return `${minutes}:${secondsInt.toString().padStart(2, '0')}${secondsDec}`
                        })()}
                      </span>
                      {!note.videoNote && note.pointName && (
                        <span className={styles.notePointName}>
                          Point: {note.pointName}
                        </span>
                      )}
                    </div>
                    <div className={styles.noteActionButtons}>
                      <button
                        type="button"
                        className={styles.jumpToButton}
                        onClick={() =>
                          handleJumpToNote(
                            note.videoNote
                              ? note.timestamp
                              : note.pointPosition || note.timestamp
                          )
                        }
                        disabled={!videoObject}
                      >
                        Jump to
                      </button>
                      <button
                        type="button"
                        className={styles.deleteNoteButton}
                        onClick={() => handleDeleteNote(note)}
                        title="Delete note"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className={styles.noteText}>{note.noteText}</p>
                  {note.createdAt && (
                    <span className={styles.noteDate}>
                      {new Date(note.createdAt).toLocaleString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={styles.noteInputContainer}>
          <div className={styles.noteInputHeader}>
            <span className={styles.timestampDisplay}>
              Timestamp:{' '}
              {currentTimestamp
                ? (() => {
                    const totalSeconds = currentTimestamp / 1000
                    const minutes = Math.floor(totalSeconds / 60)
                    const seconds = totalSeconds % 60
                    const secondsInt = Math.floor(seconds)
                    const secondsDec = (seconds % 1).toFixed(2).substring(1)
                    return `${minutes}:${secondsInt.toString().padStart(2, '0')}${secondsDec}`
                  })()
                : 'N/A'}
            </span>
            {nearestPoint && (
              <span className={styles.pointInfo}>
                Point: {nearestPoint.Name || 'N/A'}
              </span>
            )}
          </div>
          <textarea
            className={styles.noteTextarea}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Enter your note here..."
            rows={4}
          />
          <div className={styles.noteButtons}>
            <button
              className={styles.saveNoteButton}
              onClick={handleSaveNote}
              disabled={!noteText.trim() || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Note'}
            </button>
            <button
              type="button"
              className={styles.cancelNoteButton}
              onClick={handleCancelNote}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Notes
