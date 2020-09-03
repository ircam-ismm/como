import BaseModule from './BaseModule.js';
import XmmProcessor from '../libs/mano/XmmProcessor.js';

class MLDecoder extends BaseModule {
  constructor(graph, type, id, options) {
    super(graph, type, id);

    // @todo - as we dont have the not normalized Likelihoods, this does not
    // allow us to implement the JIP-like emergence thing...
    //
    // @note - XMM output:
    // - likeliest {String}
    // - likeliestIndex {Integer}
    // - likelihoods {Array}
    // - outputCovariance {Array}
    // - outputValues {Array}

    this.decoder = new XmmProcessor();
    this.overrideLikeliest = false;

    // what is this default value
    this.decoder.setConfig({ likelihoodWindow: this.options.likelihoodWindow });
    // @todo - this should be related to module options, not to the session
    this.unsubscribeSession = this.graph.session.subscribe(updates => {
      for (let name in updates) {
        switch (name) {
          case 'model':
            this.decoder.setModel(updates['model']);
            break;
        }
      }
    });

    this.unsubscribePlayer = this.graph.player.subscribe(updates => {
      for (let name in updates) {
        switch (name) {
          case 'recordingState':
            switch(updates[name]) {
              case 'idle':
                this.overrideLikeliest = false;
                break;
              default:
                this.overrideLikeliest = true;
                break;
            }
            break;
          case 'preview':
            if (updates[name]) {
              this.overrideLikeliest = true;
            } else {
              this.overrideLikeliest = false;
            }
            break;
        }
      }
    });

    const model = this.graph.session.get('model');
    this.decoder.setModel(model);
  }

  destroy() {
    this.unsubscribeSession();
    this.unsubscribePlayer();
  }

  execute(inputFrame) {
    this.outputFrame.data[this.id] = this.decoder.run(inputFrame.data);

    if (this.overrideLikeliest === true) {
      this.outputFrame.data[this.id].likeliest = this.graph.player.get('label');
    }

    return this.outputFrame;
  }
}

export default MLDecoder;
