export default ComoServer;
/**
 * Server-side representation of a ComoNode
 *
 * @extends ComoNode
 * @example
 * import { Server } from '@soundworks/core/server.js';
 * import { ComoServer } from '@ircam/como/server.js';
 *
 * const server = new Server(config);
 * const como = new ComoServer(server);
 * await como.start();
 */
declare class ComoServer extends ComoNode {
    /**
     * Constructs a new ComoServer instance
     *
     * @param {Server} server - Instance of soundworks server
     * @param {Object} options
     * @param {String} [options.projectsDirname='projects'] - Directory in which the projects live (unstable)
     */
    constructor(server: Server, { projectsDirname, }?: {
        projectsDirname?: string;
    });
    #private;
}
import ComoNode from './ComoNode.js';
//# sourceMappingURL=ComoServer.d.ts.map