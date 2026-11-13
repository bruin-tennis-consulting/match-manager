'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/app/AuthWrapper'
import { watchPlaylists } from '@/app/services/playlists'

export default function usePlaylists() {
  const { authUser } = useAuth()
  const uid = authUser?.uid

  const [state, setState] = useState({
    uid: null,
    items: [],
    loading: true,
    error: ''
  })

  useEffect(() => {
    if (!uid) return

    setState({
      uid,
      items: [],
      loading: true,
      error: ''
    })

    return watchPlaylists(
      uid,
      (items) => {
        setState({
          uid,
          items,
          loading: false,
          error: ''
        })
      },
      () => {
        setState({
          uid,
          items: [],
          loading: false,
          error:
            'Could not load playlists. Check your connection and Firestore playlist permissions.'
        })
      }
    )
  }, [uid])

  return {
    uid,
    playlists: state.uid === uid ? state.items : [],
    loading: state.uid !== uid || state.loading,
    error: state.uid === uid ? state.error : ''
  }
}
