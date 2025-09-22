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
  script: {
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
}
