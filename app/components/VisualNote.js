'use client'

import React, { useState, useEffect, useRef } from 'react'

export default function VisualNote({
  matchData,
  updateMatch,
  matchId,
  visualType,
  onNoteSaved
}) {
  const noteField = `${visualType}Note`
  const [notes, setNotes] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const textareaRef = useRef(null)
  const saveTimeoutRef = useRef(null)

  useEffect(() => {
    if (matchData && matchData[noteField]) {
      setNotes(matchData[noteField])
    } else {
      setNotes('')
    }
  }, [matchData, noteField])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [notes])

  useEffect(() => {
    // Only trigger autosave if notes string differs from what's currently saved in matchData
    const savedNote = (matchData && matchData[noteField]) || ''
    if (notes === savedNote) return

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

    saveTimeoutRef.current = setTimeout(async () => {
      if (!updateMatch || !matchId) return
      setSaveMessage('Saving...')
      try {
        await updateMatch(
          matchId,
          { [noteField]: notes },
          { skipRefetch: true, skipMatchesStateUpdate: true }
        )
        if (onNoteSaved) {
          onNoteSaved({
            ...matchData,
            [noteField]: notes
          })
        }
        setSaveMessage('Saved')
        setTimeout(() => setSaveMessage(''), 2000)
      } catch (error) {
        console.error('Error saving notes:', error)
        setSaveMessage('Error saving notes')
      }
    }, 1000)

    return () => clearTimeout(saveTimeoutRef.current)
  }, [notes, matchData, noteField, updateMatch, matchId])

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: '#fff',
        border: '1px solid #eaeaea',
        borderRadius: '10px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '1vw',
          borderBottom: '1px solid #eaeaea',
          backgroundColor: '#fafafa'
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '1.2vw' }}>Notes</span>
        <span
          style={{
            color: saveMessage.includes('Error') ? 'red' : '#888',
            fontSize: '0.9vw'
          }}
        >
          {saveMessage}
        </span>
      </div>
      <textarea
        ref={textareaRef}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add your notes here..."
        style={{
          width: '100%',
          minHeight: '150px',
          padding: '1vw',
          border: 'none',
          backgroundColor: 'transparent',
          fontSize: '1vw',
          fontFamily: 'inherit',
          resize: 'none',
          outline: 'none',
          overflow: 'hidden'
        }}
      />
    </div>
  )
}
