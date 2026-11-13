import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  runTransaction,
  deleteDoc
} from 'firebase/firestore'
import { db } from './initializeFirebase'

const playlists = (uid) => collection(db, 'users', uid, 'playlists')

export const watchPlaylists = (uid, next, error) =>
  onSnapshot(
    playlists(uid),
    (snapshot) => {
      next(
        snapshot.docs
          .map((document) => ({
            ...document.data(),
            id: document.id
          }))
          .sort((a, b) => b.updatedAt - a.updatedAt)
      )
    },
    error
  )

export function createPlaylist(uid, title, description = '') {
  if (!title.trim()) {
    throw new Error('Enter a playlist name.')
  }

  return addDoc(playlists(uid), {
    title: title.trim().slice(0, 100),
    description: description.trim().slice(0, 1000),
    clips: [],
    updatedAt: Date.now()
  })
}

export function makeClip(matchId, match, point) {
  const startMs = Number(point.Position)

  if (!Number.isFinite(startMs) || startMs < 0 || !match.videoId) {
    throw new Error('This point has no valid video timestamp.')
  }

  return {
    id: JSON.stringify([matchId, startMs, point.Name || '']),
    matchId,
    videoId: match.videoId,
    startMs,
    durationMs: Number.isFinite(Number(point.Duration))
      ? Math.max(0, Number(point.Duration))
      : 0,
    matchLabel: `${
      point.player1Name || match.teams?.clientTeam || 'Player 1'
    } vs ${point.player2Name || match.teams?.opponentTeam || 'Player 2'}`,
    score: `Set ${point.setNum ?? '–'} · ${
      point.gameScore ?? '–'
    } · ${point.pointScore ?? '–'}`
  }
}

export async function editPlaylist(uid, id, change) {
  const reference = doc(playlists(uid), id)

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference)

    if (!snapshot.exists()) {
      throw new Error('This playlist no longer exists.')
    }

    const patch = change(snapshot.data())

    transaction.update(reference, {
      ...patch,
      updatedAt: Date.now()
    })
  })
}

export const addClip = (uid, id, clip) =>
  editPlaylist(uid, id, (data) => {
    const clips = data.clips || []

    if (clips.some((existing) => existing.id === clip.id)) {
      return {}
    }

    if (clips.length >= 200) {
      throw new Error(
        'This playlist is full (200 points). Create another playlist.'
      )
    }

    return {
      clips: [...clips, clip]
    }
  })

export const removeClip = (uid, id, clipId) =>
  editPlaylist(uid, id, (data) => ({
    clips: (data.clips || []).filter((clip) => clip.id !== clipId)
  }))

export const deletePlaylist = (uid, id) => deleteDoc(doc(playlists(uid), id))
