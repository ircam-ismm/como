import BaseModule from './BaseModule';
import { copyFrameData } from './helpers';

// states: idle, armed, recording, pending, confirm, cancel

class ExampleRecorder extends BaseModule {
  constructor(graph, type, id, options) {
    super(graph, type, id, options);

    this.currentState = null;
    this.record = false;
    this.example = null;
    this.unsubscribe = null;

    if (this.graph.player) {
      this.unsubscribe = this.graph.player.subscribe(updates => {
        if ('recordingState' in updates) {
          const state = updates['recordingState'];
          this.setState(state);
        }
      });

      // @note - we need a recording target too...
      const recordingState = this.graph.player.get('recordingState');
      this.setState(recordingState);
    }
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  setState(recordingState) {
    if (this.currentState === recordingState) {
      return;
    }

    this.currentState = recordingState;

    switch (recordingState) {
      case 'idle': {
        this.record = false;
        this.example = null;
        break;
      }
      case 'armed': {
        break;
      }
      case 'recording': {
        this.record = true;
        this.example = {
          label: null,
          input: [],
          output: [],
        };

        break;
      }
      case 'pending':
        this.record = false;
        break;
      case 'confirm': {
        // if input.length === 0, crashes xmm-node
        if (this.example.input.length > 0) {
          this.example.label = this.graph.player.get('label');
          this.graph.session.addExample(this.example);
        }

        this.graph.player.set({ recordingState: 'idle' });
        break;
      }
      case 'cancel': {
        this.example = null;
        this.graph.player.set({ recordingState: 'idle' });
        break;
      }
    }
  }

  // override process and not execute to make sure they is no further node
  // this is a deadend
  process(inputFrame) {
    if (this.record) {
      const inputData = inputFrame.data;
      const copy = {};

      copyFrameData(inputData, copy);

      this.example.input.push(copy);
    }
  }
}

export default ExampleRecorder;
