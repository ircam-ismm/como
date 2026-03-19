/**
 * @typedef {Object} PlayerClassDescription
 * @property {String} id - Id of the player (generated or user-defined)
 * @property {String} nodeId - Id of the node on which the player has been created
 * @property {String} sourceId - Id of the source associated with the player
 * @property {String} sessionId - If the session with which the player is associated.
 *  null is associated to no session.
 * @property {Boolean} sessionLoading - True if the session is currently loading, false otherwise
 * @property {String} scriptName - Name of the script associated to this player.
 * @property {Boolean} scriptLoaded - Event that triggers whe the script is ready.
 * @property {Boolean} mute - Mute the audio of this player.
 * @property {Number} volume - Volume of the audio of this player, in dB.
 */
export default {
  id: {
    type: 'string',
    required: true,
  },
  nodeId: {
    type: 'integer',
    required: true,
  },
  sourceId: {
    type: 'string',
    required: true,
  },
  sessionId: {
    type: 'string',
    default: null,
    nullable: true,
  },
  sessionLoading: {
    type: 'boolean',
    default: false,
  },
  scriptName: {
    type: 'string',
    nullable: true,
    default: null,
  },
  scriptSharedStateClassName: {
    type: 'string',
    nullable: true,
    default: null,
  },
  scriptSharedStateId: {
    type: 'integer',
    nullable: true,
    default: null,
  },
  scriptLoaded: {
    type: 'boolean',
    event: true,
  },

  // audio
  mute: {
    type: 'boolean',
    default: false,
  },
  volume: {
    type: 'float',
    min: -80,
    max: 12,
    default: 0,
  },
}
