/** @private */
export default {
  name: {
    type: 'string',
    event: true,
  },
  sourceNodeId: {
    type: 'integer',
    event: true,
  },
  executorNodeId: {
    type: 'integer',
    event: true,
  },
  commandId: {
    type: 'integer',
    event: true,
  },
  payload: {
    type: 'any',
    event: true,
  },
  settled: {
    type: 'boolean',
    event: true,
  },
  responseAck: {
    type: 'any',
    event: true,
  },
  responseErr: {
    type: 'any',
    event: true,
  },
};
