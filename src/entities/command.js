// import {
//   isString,
// } from '@ircam/sc-utils';

// import {
//   ComoSourceType
// } from './types.js';

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

// export function validateCommand(name, payload) {
//   switch (name) {
//     case 'createSource': {
//       // id of the source
//       if (!isString(payload.sourceId)) {
//         throw new Error(`Invalid payload for command "${name}": payload.id (${payload.sourceId}) is not a string`);
//       }

//       if (!(ComoSourceType.includes(payload.type))) {
//         throw new Error(`Invalid payload for command "${name}": payload.type (${payload.type}) is not a valid source type`);
//       }

//       if (!Number.isInteger(payload.nodeId)) {
//         throw new Error(`Invalid payload for command "${name}": payload.type (${payload.type}) is not a valid source type`);
//       }

//       break;
//     }
//     case 'test': {
//       break;
//     }
//     default: {
//       throw new Error(`Unknown command: ${command}`);
//     }
//   }
// }
