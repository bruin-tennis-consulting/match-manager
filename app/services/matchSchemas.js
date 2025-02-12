//import { initialSchema, uiSchema as baseUiSchema } from '@/app/services/matchSchemas.js'

const initialSchema = {
  title: 'Upload Match',
  type: 'object',
  properties: {
    collection: {
      type: 'string',
      title: 'Collection',
      enum: []
    },
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
    clientUTR: {
      type: 'string',
      title: 'Client UTR'
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
    opponentUTR: {
      type: 'string',
      title: 'Opponent UTR'
    },
    date: {
      type: 'string',
      title: 'Date',
      format: 'date'
    },
    unfinished: {
      type: 'boolean',
      title: 'Unfinished'
    },
    duel: {
      type: 'boolean',
      title: 'Duel'
    },
    matchScore: {
      type: 'object',
      title: 'Match Score',
      properties: {
        set1: {
          type: 'object',
          title: 'Set 1',
          properties: {
            clientGames: { type: 'number', title: 'Client Games' },
            opponentGames: { type: 'number', title: 'Opponent Games' },
            clientTiebreak: {
              type: 'number',
              title: 'Client Tiebreak (if applicable)'
            },
            opponentTiebreak: {
              type: 'number',
              title: 'Opponent Tiebreak (if applicable)'
            }
          }
        },
        set2: {
          type: 'object',
          title: 'Set 2',
          properties: {
            clientGames: { type: 'number', title: 'Client Games' },
            opponentGames: { type: 'number', title: 'Opponent Games' },
            clientTiebreak: {
              type: 'number',
              title: 'Client Tiebreak (if applicable)'
            },
            opponentTiebreak: {
              type: 'number',
              title: 'Opponent Tiebreak (if applicable)'
            }
          }
        },
        set3: {
          type: 'object',
          title: 'Set 3 (if applicable)',
          properties: {
            clientGames: { type: 'number', title: 'Client Games' },
            opponentGames: { type: 'number', title: 'Opponent Games' },
            clientTiebreak: {
              type: 'number',
              title: 'Client Tiebreak (if applicable)'
            },
            opponentTiebreak: {
              type: 'number',
              title: 'Opponent Tiebreak (if applicable)'
            }
          }
        }
      }
    },
    division: {
      type: 'string',
      title: 'Division',
      enum: ['D1']
    },
    event: {
      type: 'string',
      title: 'Event'
    },
    lineup: {
      type: 'string',
      title: 'Lineup'
    },
    matchVenue: {
      type: 'string',
      title: 'Match Venue'
    },
    round: {
      type: 'string',
      title: 'Round'
    },
    videoID: {
      type: 'string',
      title: 'Video ID'
    },
    temperature: {
      type: 'string',
      title: 'Temperature'
    },
    weather: {
      type: 'string',
      title: 'Weather',
      enum: ['Cloudy', 'Windy']
    },
    court: {
      type: 'string',
      title: 'Court',
      enum: ['Outdoor', 'Indoor']
    },
    surface: {
      type: 'string',
      title: 'Surface',
      enum: ['Hard', 'Clay', 'Grass']
    },
    singlesDoubles: {
      type: 'string',
      title: 'Singles/Doubles',
      enum: ['Singles', 'Doubles']
    },
    jsonFile: {
      type: 'string',
      title: 'JSON File',
      format: 'data-url'
    },
    pdfFile: {
      type: 'string',
      title: 'PDF File'
      // format: 'data-url'
    }
  },
  required: [
    'collection',
    'clientTeam',
    'clientPlayer',
    'opponentTeam',
    'opponentPlayer',
    'matchScore',
    'date',
    'videoID'
  ]
}

const uiSchema = {
  jsonFile: {
    'ui:widget': 'file'
  },
  pdfFile: {
    'ui:widget': 'file'
  },

  event: {
    'ui:disabled': (formData) => !formData.duel  // the "event" field is disabled when "dual" is not selected
  },

  matchScore: {
    set1: {
      clientTiebreak: {
        'ui:widget': 'text',
        'ui:options': {
          inputType: 'number'
        }
      },
      opponentTiebreak: {
        'ui:widget': 'text',
        'ui:options': {
          inputType: 'number'
        }
      }
    },
    set2: {
      clientTiebreak: {
        'ui:widget': 'text',
        'ui:options': {
          inputType: 'number'
        }
      },
      opponentTiebreak: {
        'ui:widget': 'text',
        'ui:options': {
          inputType: 'number'
        }
      }
    },
    set3: {
      clientTiebreak: {
        'ui:widget': 'text',
        'ui:options': {
          inputType: 'number'
        }
      },
      opponentTiebreak: {
        'ui:widget': 'text',
        'ui:options': {
          inputType: 'number'
        }
      }
    }
  }
}

export { initialSchema, uiSchema }
