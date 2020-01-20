export default {
  list: {
    type: 'any',
    default : [],
  },
  created: {
    type: 'any',
    default: null,
    nullable: true,
    event: true,
  },
  deleted: {
    type: 'any',
    default: null,
    nullable: true,
    event: true,
  }
}
