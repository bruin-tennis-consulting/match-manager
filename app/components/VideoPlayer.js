import React, { useEffect, useRef } from 'react'
import styles from '../styles/VideoPlayer.module.css'

function VideoPlayer({ videoId, setVideoObject, onReady }) {
  const playerRef = useRef(null)

  useEffect(() => {
    const initializePlayer = () => {
      const playerWidth = document.getElementById('player').offsetWidth
      const playerHeight = Math.ceil((playerWidth / 16) * 9) // Assuming 16:9 aspect ratio

      playerRef.current = new window.YT.Player('player', {
        videoId,
        events: {
          onReady: onPlayerReady
        },
        playerVars: {
          origin: 'http://localhost:3000'
        },
        width: '100%', // Adjust the width here
        height: playerHeight
      })
      setVideoObject(playerRef.current)
    }

    if (!window.YT) {
      // Load the YouTube iframe API script
      const tag = document.createElement('script')
      tag.id = 'youtube-api-script'
      tag.src = 'https://www.youtube.com/iframe_api'

      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)

      // Define the callback function for when the API is ready
      window.onYouTubeIframeAPIReady = initializePlayer
    } else {
      // If the API is already loaded, initialize the player immediately
      initializePlayer()
    }

    return () => {
      // Clean up the player
      if (playerRef.current) {
        playerRef.current.destroy()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, setVideoObject])

  useEffect(() => {
    if (playerRef.current && playerRef.current.loadVideoById) {
      playerRef.current.loadVideoById(videoId)
    }
  }, [videoId])

  const onPlayerReady = () => {
    console.log('player is ready')
    if (onReady) {
      onReady()
    }
  }

  return (
    <div className={styles.container}>
      <div id="player" className={styles.player}></div>
    </div>
  )
}

export default VideoPlayer
