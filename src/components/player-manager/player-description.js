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
