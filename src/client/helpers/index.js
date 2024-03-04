// common helpers
import helpers from '../../common/helpers/index.js';
// synths
import BufferPlayer from './synth/BufferPlayer.js';
import SyncedBufferPlayer from './synth/SyncedBufferPlayer.js';

helpers.fx = {};
helpers.synth = { BufferPlayer, SyncedBufferPlayer };

export default helpers;

