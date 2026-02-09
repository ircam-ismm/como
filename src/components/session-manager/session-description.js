const Session = {
  uuid: {
    type: 'string',
    required: true,
    // @todo - readonly / unique
    metas: {
      persist: true,
    },
  },
  dirty: {
    type: 'boolean',
    default: false,
  },
  name: {
    type: 'string',
    required: true,
    metas: {
      persist: true,
    },
  },
  defaultScript: {
    type: 'string',
    default: null,
    nullable: true,
    metas: {
      persist: true,
    },
  },
  mute: {
    type: 'boolean',
    default: false,
    metas: {
      persist: true,
    },
  },
  volume: {
    type: 'float',
    default: 0,
    min: -120,
    max: 12,
    metas: {
      persist: true,
    },
  },
  soundbank: {
    type: 'any', // should be a Set
    default: [],
    metas: {
      persist: true,
    },
  },
};

export default Session;
