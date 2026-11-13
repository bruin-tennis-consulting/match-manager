'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import usePlaylists from '@/app/hooks/usePlaylists'
import {
  createPlaylist,
  editPlaylist,
  deletePlaylist,
  removeClip
} from '@/app/services/playlists'
import styles from '@/app/styles/Playlists.module.css'

export default function PlaylistsPage() {
  const { uid, playlists, loading, error } = usePlaylists()

  const [selected, setSelected] = useState('')
  const [activeId, setActiveId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(false)

  const playlist = playlists.find((item) => item.id === selected)

  const clips = playlist?.clips || []
  const active = clips.find((clip) => clip.id === activeId) || clips[0]

  const activeIndex = clips.findIndex((clip) => clip.id === active?.id)

  useEffect(() => {
    setActiveId('')
    setEditing(false)
    setMessage('')
  }, [selected])

  async function perform(action) {
    setBusy(true)
    setMessage('')

    try {
      await action()
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  function beginEdit() {
    setTitle(playlist.title)
    setDescription(playlist.description || '')
    setEditing(true)
  }

  async function saveDetails(event) {
    event.preventDefault()

    await perform(async () => {
      if (editing) {
        await editPlaylist(uid, playlist.id, () => ({
          title: title.trim(),
          description: description.trim()
        }))

        setEditing(false)
      } else {
        const created = await createPlaylist(uid, title, description)

        setSelected(created.id)
      }
    })
  }

  function handleDelete() {
    const confirmed = window.confirm(
      `Delete “${playlist.title}” and its saved point references?`
    )

    if (!confirmed) return

    perform(async () => {
      await deletePlaylist(uid, playlist.id)
      setSelected('')
      setTitle('')
      setDescription('')
    })
  }

  const start = active ? Math.floor(active.startMs / 1000) : 0

  const end =
    active?.durationMs > 0
      ? Math.ceil((active.startMs + active.durationMs) / 1000)
      : null

  return (
    <main className={styles.page}>
      <Link href="/">← Match dashboard</Link>

      <h1>Review playlists</h1>

      <p>
        Collect points across matches and keep your observations beside the
        video.
      </p>

      {loading && <p role="status">Loading playlists…</p>}

      {(error || message) && <p role="alert">{error || message}</p>}

      <div className={styles.layout}>
        <aside className={styles.card}>
          <h2>Your playlists</h2>

          {playlists.map((item) => (
            <button
              key={item.id}
              className={styles.playlistButton}
              aria-pressed={selected === item.id}
              disabled={busy}
              onClick={() => setSelected(item.id)}
            >
              {item.title} · {item.clips?.length || 0} points
            </button>
          ))}

          {!loading && !error && !playlists.length && (
            <p>Create your first playlist, then add points from a match.</p>
          )}

          <button
            disabled={busy}
            onClick={() => {
              setSelected('')
              setTitle('')
              setDescription('')
              setEditing(false)
            }}
          >
            + New playlist
          </button>
        </aside>

        <section className={styles.card}>
          {!playlist || editing ? (
            <form onSubmit={saveDetails}>
              <h2>{editing ? 'Edit playlist' : 'Create a playlist'}</h2>

              <label>
                Name
                <input
                  required
                  maxLength={100}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>

              <label>
                What should we look for?
                <textarea
                  maxLength={1000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Watch how the return position changes on second serves."
                />
              </label>

              <button
                disabled={busy || !uid || loading || !!error || !title.trim()}
              >
                {busy ? 'Saving…' : 'Save playlist'}
              </button>

              {editing && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              )}
            </form>
          ) : (
            <>
              <h2>{playlist.title}</h2>

              <p className={styles.description}>{playlist.description}</p>

              <div className={styles.actions}>
                <button disabled={busy} onClick={beginEdit}>
                  Edit details
                </button>

                <button disabled={busy} onClick={handleDelete}>
                  Delete playlist
                </button>
              </div>

              {active ? (
                <>
                  <h3>{active.matchLabel}</h3>

                  <p>
                    {active.score} · Point {activeIndex + 1} of {clips.length}
                  </p>

                  <iframe
                    className={styles.video}
                    key={`${playlist.id}-${active.id}`}
                    title="Saved tennis point"
                    src={`https://www.youtube.com/embed/${encodeURIComponent(
                      active.videoId
                    )}?start=${start}${end ? `&end=${end}` : ''}&rel=0`}
                    allow="encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                  />

                  <div className={styles.actions}>
                    <button
                      disabled={activeIndex <= 0}
                      onClick={() => setActiveId(clips[activeIndex - 1].id)}
                    >
                      Previous point
                    </button>

                    <button
                      disabled={activeIndex >= clips.length - 1}
                      onClick={() => setActiveId(clips[activeIndex + 1].id)}
                    >
                      Next point
                    </button>

                    <Link
                      href={`/matches/${encodeURIComponent(active.matchId)}`}
                    >
                      Open full match
                    </Link>
                  </div>
                </>
              ) : (
                <p>
                  No points yet. Open a match and select “+ Playlist” next to a
                  point.
                </p>
              )}

              <ol className={styles.clips}>
                {clips.map((clip) => (
                  <li key={clip.id}>
                    <button
                      aria-pressed={active?.id === clip.id}
                      onClick={() => setActiveId(clip.id)}
                    >
                      {clip.matchLabel}
                      <br />
                      {clip.score} · {Math.floor(clip.startMs / 60000)}:
                      {String(Math.floor(clip.startMs / 1000) % 60).padStart(
                        2,
                        '0'
                      )}
                    </button>

                    <button
                      disabled={busy}
                      aria-label={`Remove ${clip.matchLabel}, ${clip.score}`}
                      onClick={() =>
                        perform(() => removeClip(uid, playlist.id, clip.id))
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
