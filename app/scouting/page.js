'use client'

import ScoutingPlayerProfile from '@/app/components/ScoutingPlayerProfile'

export default function ScoutingPlayerProfilePage() {
  // This mock data would typically come from the backend or Firebase
  const mockData = {
    firstName: 'First',
    lastName: 'Last',
    age: '00',
    height: "0'00",
    class: 'Freshman',
    position: '#0',
    plays: 'Right',
    backhand: '2-Handed',
    bio: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    photo: '',
    recentMatches: [
      {
        eventName: 'Event Name',
        date: 'January 1st, 2025',
        serviceGamesHeld: 0,
        aces: 0,
        finalScore: [
          [0, 0, 0],
          [0, 0, 0]
        ],
        players: ['Player Name', 'Player Name'],
        videoUrl: '#'
      },
      {
        eventName: 'Event Name',
        date: 'January 1st, 2025',
        serviceGamesHeld: 0,
        aces: 0,
        finalScore: [
          [0, 0, 0],
          [0, 0, 0]
        ],
        players: ['Player Name', 'Player Name'],
        videoUrl: '#'
      },
      {
        eventName: 'Event Name',
        date: 'January 1st, 2025',
        serviceGamesHeld: 0,
        aces: 0,
        finalScore: [
          [0, 0, 0],
          [0, 0, 0]
        ],
        players: ['Player Name', 'Player Name'],
        videoUrl: '#'
      }
    ]
  }

  return <ScoutingPlayerProfile playerData={mockData} />
}
