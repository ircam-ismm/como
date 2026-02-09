export default ComoClient;
/**
 * Server-side representation of a ComoNode
 *
 * @extends ComoNode
 * @example
 * import { Client } from '@soundworks/core/client.js';
 * import { ComoClient } from '@ircam/como/client.js';
 *
 * const client = new Client(config);
 * const como = new ComoClient(client);
 * await como.start();
 */
declare class ComoClient extends ComoNode {
    /**
     * Constructs a new ComoClient instance
     *
     * @param {Client} node - Instance of soundworks client
     */
    constructor(node: Client);
}
import ComoNode from './ComoNode.js';
//# sourceMappingURL=ComoClient.d.ts.map