export const filterGroups = {
  score: {
    title: 'Score',
    subCategories: {
      pointScore: {
        title: 'Point Score',
        values: [
          '0-0',
          '15-0',
          '30-0',
          '40-0',
          '0-15',
          '15-15',
          '30-15',
          '40-15',
          '0-30',
          '15-30',
          '30-30',
          '40-30',
          '0-40',
          '15-40',
          '30-40',
          '40-40'
        ]
      },
      gameScore: {
        title: 'Game Score',
        values: [
          '0-0',
          '1-0',
          '2-0',
          '3-0',
          '4-0',
          '5-0',
          '6-0',
          '0-1',
          '1-1',
          '2-1',
          '3-1',
          '4-1',
          '5-1',
          '6-1',
          '0-2',
          '1-2',
          '2-2',
          '3-2',
          '4-2',
          '5-2',
          '6-2',
          '0-3',
          '1-3',
          '2-3',
          '3-3',
          '4-3',
          '5-3',
          '6-3',
          '0-4',
          '1-4',
          '2-4',
          '3-4',
          '4-4',
          '5-4',
          '6-4',
          '0-5',
          '1-5',
          '2-5',
          '3-5',
          '4-5',
          '5-5',
          '6-5',
          '0-6',
          '1-6',
          '2-6',
          '3-6',
          '4-6',
          '5-6',
          '6-6'
        ]
      },
      setScore: {
        title: 'Set Score',
        values: ['0-0', '1-0', '0-1', '1-1']
      },
      tiebreak: {
        title: 'Tiebreak',
        type: 'checkbox'
      },
      breakPoint: {
        title: 'Break Point',
        type: 'checkbox'
      }
    }
  },
  serve: {
    title: 'Serve',
    players: {
      player1: {
        title: 'Player 1',
        categories: {
          servePlacement: {
            title: 'Serve Placement',
            values: ['Wide', 'Body', 'T']
          },
          serveResult: {
            title: 'Serve Result',
            values: ['Ace', 'Ball In Play']
          },
          serveSide: {
            title: 'Serve Side',
            values: ['Deuce', 'Ad']
          }
        }
      },
      player2: {
        title: 'Player 2',
        categories: {
          servingSide: {
            title: 'Serving Side',
            values: ['Deuce', 'Ad']
          },
          servePlacement: {
            title: 'Serve Placement',
            values: ['Wide', 'Body', 'T']
          },
          serveResult: {
            title: 'Serve Result',
            values: ['Ace', 'Ball In Play']
          }
        }
      }
    }
  },
  return: {
    title: 'Return',
    players: {
      player1: {
        title: 'Player 1',
        categories: {
          returningSide: {
            title: 'Returning Side',
            values: ['Deuce', 'Ad']
          },
          returnPlacement: {
            title: 'Return Placement',
            values: ['Down the Line', 'Cross Court']
          }
        }
      },
      player2: {
        title: 'Player 2',
        categories: {
          returnFhBh: {
            title: 'Return Forehand/Backhand',
            values: ['Forehand', 'Backhand']
          },
          returnPlacement: {
            title: 'Return Placement',
            values: ['Down the Line', 'Cross Court']
          }
        }
      }
    }
  },
  rally: {
    title: 'Rally',
    subCategories: {
      rallyLength: {
        title: 'Rally Length',
        values: ['1-4', '5-8', '9+']
      },
      pointWonBy: {
        title: 'Point Won By',
        values: ['Player 1', 'Player 2']
      },
      shotType: {
        title: 'Shot Type',
        values: ['Lob', 'Approach', 'Dropshot', 'Slice', 'Overhead']
      },
      approach: {
        title: 'Approach',
        type: 'checkbox'
      }
    }
  },
  lastShot: {
    title: 'Last Shot',
    subCategories: {
      winner: {
        title: 'Winner',
        type: 'checkbox'
      },
      forcedError: {
        title: 'Forced Error',
        type: 'checkbox'
      },
      unforcedError: {
        title: 'Unforced Error',
        type: 'checkbox'
      }
    }
  }
}
