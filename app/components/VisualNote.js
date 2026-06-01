'use client'

import React, { useState, useEffect, useRef } from 'react'

export default function VisualNote({
  matchData,
  updateMatch,
  matchId,
  visualType,
  onNoteSaved,
  onCollapsedChange
}) {
  const noteField = `${visualType}Note`
  const [notes, setNotes] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)
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
    if (textareaRef.current && isExpanded) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [notes, isExpanded])

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

  const handleToggle = () => {
    const newExpanded = !isExpanded
    setIsExpanded(newExpanded)
    if (onCollapsedChange) onCollapsedChange(!newExpanded)
  }

  return (
    <div
      style={{
        backgroundColor: '#fafafa',
        border: '1px solid #eaeaea',
        borderRadius: '10px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.28s cubic-bezier(0.25, 0.1, 0.25, 1)',
        width: isExpanded ? '100%' : '48px'
      }}
    >
      {/* Toggle header */}
      <div
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: isExpanded ? 'center' : 'center',
          justifyContent: isExpanded ? 'space-between' : 'center',
          flexDirection: isExpanded ? 'row' : 'column',
          padding: isExpanded ? '1vw' : '1vw 0',
          gap: isExpanded ? '0' : '0.5vw',
          borderBottom: isExpanded ? '1px solid #eaeaea' : 'none',
          backgroundColor: '#fafafa',
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5vw',
            flexDirection: isExpanded ? 'row' : 'column'
          }}
        >
          <span
            style={{
              fontSize: '0.9vw',
              color: '#666'
            }}
          >
            {isExpanded ? '▼' : '◀'}
          </span>
          <span
            style={{
              fontWeight: 'bold',
              fontSize: isExpanded ? '1.2vw' : '1vw',
              writingMode: isExpanded ? 'horizontal-tb' : 'vertical-rl',
              textOrientation: 'mixed',
              letterSpacing: isExpanded ? 'normal' : '1px'
            }}
          >
            Notes
          </span>
        </div>
        {isExpanded && (
          <span
            style={{
              color: saveMessage.includes('Error') ? 'red' : '#888',
              fontSize: '0.9vw'
            }}
          >
            {saveMessage}
          </span>
        )}
      </div>

      {/* Textarea body */}
      <div
        style={{
          opacity: isExpanded ? 1 : 0,
          transition: 'opacity 0.2s ease',
          overflow: 'hidden'
        }}
      >
        {isExpanded && (
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
              backgroundColor: '#fff',
              fontSize: '1vw',
              fontFamily: 'inherit',
              resize: 'none',
              outline: 'none',
              overflow: 'hidden',
              boxSizing: 'border-box'
            }}
          />
        )}
      </div>
    </div>
  )
}
