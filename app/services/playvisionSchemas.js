// Schema and uiSchema definitions

const initialSchema = {
  title: 'Playvision Upload Match',
  type: 'object',
  properties: {
    clientTeam: {
      type: 'string',
      title: 'Client Team',
      enum: []
    },
    clientPlayer: {
      type: 'string',
      title: 'Client Player',
      enum: []
    },
    opponentTeam: {
      type: 'string',
      title: 'Opponent Team',
      enum: []
    },
    opponentPlayer: {
      type: 'string',
      title: 'Opponent Player'
    },

    date: {
      type: 'string',
      title: 'Date',
      format: 'date'
    },

    alreadyUploaded: {
      type: 'boolean',
      title: 'Already Uploaded on Upload-Match?'
    },

    stats: {
      type: 'object',
      title: 'Match Stats',
      properties: {
        serviceWinners: {
          type: 'object',
          title: 'Service Winners',
          properties: {
            client: { type: 'number', title: 'Client' },
            opponent: { type: 'number', title: 'Opponent' }
          }
        },
        doubleFaults: {
          type: 'object',
          title: 'Double Faults',
          properties: {
            client: { type: 'number', title: 'Client' },
            opponent: { type: 'number', title: 'Opponent' }
          }
        },
        winners: {
          type: 'object',
          title: 'Winners',
          properties: {
            client: { type: 'number', title: 'Client' },
            opponent: { type: 'number', title: 'Opponent' }
          }
        },
        forehandWinners: {
          type: 'object',
          title: 'Forehand Winners',
          properties: {
            client: { type: 'number', title: 'Client' },
            opponent: { type: 'number', title: 'Opponent' }
          }
        },
        backhandWinners: {
          type: 'object',
          title: 'Backhand Winners',
          properties: {
            client: { type: 'number', title: 'Client' },
            opponent: { type: 'number', title: 'Opponent' }
          }
        },
        unforcedErrors: {
          type: 'object',
          title: 'Unforced Errors',
          properties: {
            client: { type: 'number', title: 'Client' },
            opponent: { type: 'number', title: 'Opponent' }
          }
        },
        forehandUnforcedErrors: {
          type: 'object',
          title: 'Forehand Unforced Errors',
          properties: {
            client: { type: 'number', title: 'Client' },
            opponent: { type: 'number', title: 'Opponent' }
          }
        },
        backhandUnforcedErrors: {
          type: 'object',
          title: 'Backhand Unforced Errors',
          properties: {
            client: { type: 'number', title: 'Client' },
            opponent: { type: 'number', title: 'Opponent' }
          }
        },
        firstServesIn: {
          type: 'object',
          title: '1st Serves In',
          properties: {
            client: { type: 'string', title: 'Client' },
            opponent: { type: 'string', title: 'Opponent' }
          }
        },
        secondServesIn: {
          type: 'object',
          title: '2nd Serves In',
          properties: {
            client: { type: 'string', title: 'Client' },
            opponent: { type: 'string', title: 'Opponent' }
          }
        },
        servePointsWon: {
          type: 'object',
          title: 'Serve Points Won',
          properties: {
            client: { type: 'string', title: 'Client' },
            opponent: { type: 'string', title: 'Opponent' }
          }
        },
        firstServesWon: {
          type: 'object',
          title: '1st Serves Won',
          properties: {
            client: { type: 'string', title: 'Client' },
            opponent: { type: 'string', title: 'Opponent' }
          }
        },
        secondServesWon: {
          type: 'object',
          title: '2nd Serves Won',
          properties: {
            client: { type: 'string', title: 'Client' },
            opponent: { type: 'string', title: 'Opponent' }
          }
        },
        breakPointsSaved: {
          type: 'object',
          title: 'Break Points Saved',
          properties: {
            client: { type: 'string', title: 'Client' },
            opponent: { type: 'string', title: 'Opponent' }
          }
        },
        returnPointsWon: {
          type: 'object',
          title: 'Return Points Won',
          properties: {
            client: { type: 'string', title: 'Client' },
            opponent: { type: 'string', title: 'Opponent' }
          }
        },
        firstReturnsWon: {
          type: 'object',
          title: '1st Returns Won',
          properties: {
            client: { type: 'string', title: 'Client' },
            opponent: { type: 'string', title: 'Opponent' }
          }
        },
        secondReturnsWon: {
          type: 'object',
          title: '2nd Returns Won',
          properties: {
            client: { type: 'string', title: 'Client' },
            opponent: { type: 'string', title: 'Opponent' }
          }
        },
        breakPointsWon: {
          type: 'object',
          title: 'Break Points Won',
          properties: {
            client: { type: 'string', title: 'Client' },
            opponent: { type: 'string', title: 'Opponent' }
          }
        },
        setPointsSaved: {
          type: 'object',
          title: 'Set Points Saved',
          properties: {
            client: { type: 'string', title: 'Client' },
            opponent: { type: 'string', title: 'Opponent' }
          }
        },
        totalPointsWon: {
          type: 'object',
          title: 'Total Points Won',
          properties: {
            client: { type: 'string', title: 'Client' },
            opponent: { type: 'string', title: 'Opponent' }
          }
        }
      }
    },

    shotStats: {
      type: 'object',
      title: 'Shot Stats',
      properties: {
        serves: {
          type: 'object',
          title: 'Serves',
          properties: {
            adSide: {
              type: 'object',
              title: 'Ad Side',
              properties: {
                servesIn: { type: 'number', title: 'Serves In %' },
                avgSpeed: { type: 'number', title: 'Average Speed (mph)' }
              }
            },
            deuceSide: {
              type: 'object',
              title: 'Deuce Side',
              properties: {
                servesIn: { type: 'number', title: 'Serves In %' },
                avgSpeed: { type: 'number', title: 'Average Speed (mph)' }
              }
            }
          }
        },
        returns: {
          type: 'object',
          title: 'Returns',
          properties: {
            adSide: {
              type: 'object',
              title: 'Ad Side',
              properties: {
                returnsIn: { type: 'number', title: 'Returns In %' },
                avgSpeed: { type: 'number', title: 'Average Speed (mph)' }
              }
            },
            deuceSide: {
              type: 'object',
              title: 'Deuce Side',
              properties: {
                returnsIn: { type: 'number', title: 'Returns In %' },
                avgSpeed: { type: 'number', title: 'Average Speed (mph)' }
              }
            }
          }
        },
        groundstrokes: {
          type: 'object',
          title: 'Groundstrokes',
          properties: {
            forehands: {
              type: 'object',
              title: 'Forehands',
              properties: {
                inPercentage: { type: 'number', title: 'In %' },
                avgSpeed: { type: 'number', title: 'Average Speed (mph)' }
              }
            },
            backhands: {
              type: 'object',
              title: 'Backhands',
              properties: {
                inPercentage: { type: 'number', title: 'In %' },
                avgSpeed: { type: 'number', title: 'Average Speed (mph)' }
              }
            }
          }
        }
      }
    }
  }
}

const uiSchema = {
  stats: {
    'ui:options': {
      collapsed: true
    }
  },
  shotStats: {
    'ui:options': {
      collapsed: true
    }
  }
}

export { initialSchema, uiSchema }
