export default {
  uuid: {
    type: 'string',
    required: true,
  },
  // user defined id, should be unique
  id: {
    type: 'string',
    required: true,
  },
  config: {
    type: 'any',
    required: true,
  },
  parameters: {
    type: 'any',
    default: null,
    nullable: true,
  },
  infos: {
    type: 'any',
    default: {},
  },
};
