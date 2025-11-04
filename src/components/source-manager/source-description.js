export default {
  // @todo - make this more robust:
  // - use proper `uuid` & rename `id` to `label`?
  // - or just make sure `id` is unique and throw if not
  id: {
    type: 'string',
    required: true,
  },
  type: {
    type: 'string',
    required: true,
  },
  nodeId: {
    type: 'integer',
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
    acknowledge: false,
    default: null,
    nullable: true,
  },
  // define if the underlying hardware is actually sending values
  active: {
    type: 'boolean',
    default: false,
  },
  // if true record the source into file
  record: {
    type: 'boolean',
    default: false,
  },
  // Pause the propagation of the underlying source, currently only implemented
  // in stream sources.
  // @todo -  Generalize to other sources
  control: {
    type: 'enum',
    list: ['play', 'pause'],
    default: 'play',
  },
  // ---------------------------------------------------
  // for `stream-player` sources only
  // @todo - black list for other sources types
  loop: {
    type: 'boolean',
    default: false,
  },
  duration: {
    type: 'float',
    default: null,
    nullable: true,
  },
  // the frame of the recording that is currently played
  // @todo - could be used to seek in the recording as well
  framePosition: {
    type: 'float',
    event: true,
  },
  // // index of the frame where the playback should start, included
  // // if loop == true, start point of the loop
  // frameStart: {
  //   type: 'integer',
  //   default: 0,
  //   min: 0,
  // },
  // // index of the frame where the playback should stop, excluded
  // // if loop == true, end point of the loop
  // frameEnd: {
  //   type: 'float',
  //   default: 0,
  //   min: 0,
  // },


  // ---------------------------------------------------
}
