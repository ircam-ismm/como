export default {
  uuid: {
    type: 'string',
    required: true,
  },
  name: {
    type: 'string',
    required: true,
  },
  defaultScript: {
    type: 'string',
    default: null,
    nullable: true,
  },
  mute: {
    type: 'boolean',
    default: false,
  },
  volume: {
    type: 'float',
    default: 0,
    min: -120,
    max: 12,
  },
};
