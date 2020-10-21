export default {
  id: {
    type: 'integer',
    default: null,
    nullable: true,
  },
  nodeId: {
    type: 'integer',
    default: null,
    nullable: true,
  },
  stateId: {
    type: 'integer',
    default: null,
    nullable: true,
  },
  metas: { // store user defined informations (cf. emodemos -> index, name)
    type: 'any',
    default: {},
  },
  sessionId: {
    type: 'string',
    default: null,
    nullable: true,
  },
  loading: {
    type: 'boolean',
    default: false,
  },
  hasDeviceMotion: {
    type: 'boolean',
    default: false,
  },

  // override graph option on the player only
  graphOptions: {
    type: 'any',
    default: {},
  },
  graphOptionsEvent: {
    type: 'any',
    default: {},
    event: true,
  },

  // @todo - this has to be rethinked and refactored to allow multiple ML
  // instances in the graph, these should be options of the ML Module.
  //
  // -> In general all these params that enable the control of modules should
  // be generalized to module options.
  //
  // // @see also `session` schema
  recordingState: {
    type: 'enum',
    list: ['idle', 'armed', 'recording', 'pending', 'confirm', 'cancel'],
    default: 'idle'
  },

  label: {
    type: 'string',
    default: null,
    nullable: true,
  },

  preview: {
    type: 'boolean',
    default: false,
  },

  //
  streamSource: {
    type: 'boolean',
    default: false,
  },
  // @todo - rename to recordStream (this is silly)
  streamRecord: {
    type: 'boolean',
    default: false,
  },
};

