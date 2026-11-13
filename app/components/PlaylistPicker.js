'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import usePlaylists from '@/app/hooks/usePlaylists'
import { addClip, createPlaylist, makeClip } from '@/app/services/playlists'
import styles from '@/app/styles/Playlists.module.css'

export default function PlaylistPicker({ matchId, match, point, onClose }) {
  const dialogRef = useRef(null)

  const { uid, playlists, loading, error } = usePlaylists()

  const [selected, setSelected] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const previous = document.activeElement
    const dialog = dialogRef.current

    const focusable = () => [
      ...dialog.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]'
      )
    ]

    focusable()[0]?.focus()

    const trap = (event) => {
      if (event.key !== 'Tab') return

      const items = focusable()
      const first = items[0]
      const last = items[items.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    dialog.addEventListener('keydown', trap)

    return () => {
      dialog.removeEventListener('keydown', trap)
      previous?.focus()
    }
  }, [])

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')

    try {
      const clip = makeClip(matchId, match, point)

      const playlistId = selected || (await createPlaylist(uid, title)).id

      await addClip(uid, playlistId, clip)

      setSaved(true)
      setMessage('Point saved to playlist.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={styles.backdrop}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) {
          onClose()
        }
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-picker-title"
      >
        <h2 id="playlist-picker-title">Add point to playlist</h2>

        {error && <p role="alert">{error}</p>}

        <form onSubmit={save}>
          <label>
            Playlist
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              disabled={busy || saved}
            >
              <option value="">Create a new playlist</option>

              {playlists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.title} ({playlist.clips?.length || 0})
                </option>
              ))}
            </select>
          </label>

          {!selected && (
            <label>
              Name
              <input
                required
                maxLength={100}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Backhand errors to review"
                disabled={busy || saved}
              />
            </label>
          )}

          <p role="status">{message}</p>

          <div className={styles.actions}>
            {!saved && (
              <button
                disabled={
                  busy ||
                  loading ||
                  !!error ||
                  !uid ||
                  (!selected && !title.trim())
                }
              >
                {busy ? 'Saving…' : 'Save point'}
              </button>
            )}

            <button type="button" onClick={onClose} disabled={busy}>
              {saved ? 'Done' : 'Cancel'}
            </button>

            {saved && <Link href="/playlists">View playlists</Link>}
          </div>
        </form>
      </section>
    </div>
  )
}
