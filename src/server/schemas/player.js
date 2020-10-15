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

  // @todo - this has to be rethinked and refactored (ok but why ?)
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

  streamRecord: {
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
};


// audioRendering: {
//   volume: 0, // dB
//   mute: true,
// },
// record: {
//   state: 'idle',
//   label: '',
//   preview: false,
// },
// streams: {
//   sensors: false,
//   decoding: false,
// },
// // as mapping are related to the project, this is populated
// // when the client is added to the project. (cf. appStore::addPlayerToProject)
// mappings: {},
