export default {
  id: {
    type: 'integer',
    required: true,
  },
  runtime: {
    type: 'string',
    required: true,
  },
  hostname: {
    type: 'string',
    default: null,
    nullable: true,
  },
  role: {
    type: 'string',
    required: true,
  },
}
