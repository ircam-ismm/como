export default {
  id: {
    type: 'string',
    required: true,
  },
  type: {
    type: 'string',
    required: true,
  },
  // configuration infos, may change depending on the actual source type
  // store infos to create QRcode, etc.
  infos: {
    type: 'any',
    required: true,
  },
  // current frame of the source stream
  // note that frame are multichannel: i.e. they can host several streams
  frame: {
    type: 'any',
    event: true,
  },
  // define if the underlying hardware is actually sending values
  active: {
    type: 'boolean',
    default: false,
  },
  // for recordingManager
  record: {
    type: 'boolean',
    default: false,
  },
  // pause the update of the shared state from the underlying source
  // @todo - define if we want for file-reader only or not...
  control: {
    type: 'enum',
    list: ['play', 'pause'],
    default: 'play',
  },
  // ---------------------------------------------------
  // for `file-reader` sources only
  // @todo - black list for other sources types
  loop: {
    type: 'boolean',
    default: false,
  },
  loopStart: {
    type: 'float',
    default: 0,
    min: 0,
  },
  loopEnd: {
    type: 'float',
    default: 0,
    min: 0,
  },
  // use as feedback (get) and seek (set)
  position: {
    type: 'float',
    event: true,
  },
  duration: {
    type: 'float',
    default: null,
    nullable: true,
  }
  // ---------------------------------------------------
}
