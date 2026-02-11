export default SoundbankManagerClient;
/**
 * Client-side representation of the {@link SoundbankManager}
 *
 * ```js
 * import { Client } from '@soundworks/core/client.js';
 * import { ComoClient } from '@ircam/como/client.js';
 *
 * const client = new Client(config);
 * const como = new ComoClient(client);
 * await como.start();
 *
 * const buffer = await como.soundbankManager.getBuffer('test.mp3');
 * ```
 *
 * On browser clients, the component automatically expose the `como-soundbank-manager` Web Component:
 *
 * ```html
 * <como-soundbank-manager
 *   .como=${como}
 * ></como-soundbank-manager>
 * <!-- or with optional session -->
 * <como-soundbank-manager
 *   .como=${como}
 *   session-id=${sessionId}
 * ></como-soundbank-manager>
 * ```
 *
 * @extends {SoundbankManager}
 */
declare class SoundbankManagerClient extends SoundbankManager {
    constructor(como: any, name: any);
    start(): Promise<void>;
}
import SoundbankManager from './SoundbankManager.js';
//# sourceMappingURL=SoundbankManagerClient.d.ts.map