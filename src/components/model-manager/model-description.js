export default {
  id: {
    type: 'string',
    default: null,
    required: true,
  },
  config: {
    type: 'any',
    default: {
      // ...
    },
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
  // examplesPerLabels: {

  // },
};
