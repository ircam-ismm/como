/**
 * Shared state class description representing a ComoNode
 *
 * @typedef {Object} ComoNodeClassDescription
 * @property {String} id - Topological id (can be fixed between different restarts):
 * - For browser clients: generated from soundworks node id, or user defined
 * through query parameter, i.e. http://host.local?id=my-client-id
 * - For node clients: hostname
 * - For server: 'server' constant
 * @property {Number} nodeId - Underlying soundworks id, unstable across restarts
 * @property {String} role - Role of the node in the application
 * @property {'browser'|'node'} runtime - Javascript runtime in which the node is running
 */
export default {
  id: {
    type: 'string',
    required: true,
  },
  nodeId: {
    type: 'integer',
    required: true,
  },
  role: {
    type: 'string',
    required: true,
  },
  runtime: {
    type: 'string',
    required: true,
  },
}
