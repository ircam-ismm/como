import BaseModule from './BaseModule.js';
import * as xmm from 'xmmjs';
// import XmmProcessor from '../libs/mano/XmmProcessor.js';

class MLDecoder extends BaseModule {
  constructor(graph, type, id, options) {
    super(graph, type, id);

    // note <= v0.1.6 : xmm-node @ xmm-client
    // @todo - as we dont have the not normalized Likelihoods, this does not
    // allow us to implement the JIP-like emergence thing...
    //
    // @note - XMM output:
    // - likeliest {String}
    // - likeliestIndex {Integer}
    // - likelihoods {Array}
    // - outputCovariance {Array}
    // - outputValues {Array}
    //
    // from v1.0.0 we use xmmjs
    // - define if it creates some edge cases
    // classes: {aerial.mp3: {…}, bubble.mp3: {…}}
    // instantLikelihoods: (2) [3.404649506909256, 0.0000034116874863165714]
    // instantNormalizedLikelihoods: (2) [0.9999989979338371, 0.0000010020661629505331]
    // labels: (2) ['aerial.mp3', 'bubble.mp3']
    // likeliest: "aerial.mp3"
    // smoothedLikelihoods: (2) [3.408098414188296, 0.0000034098759289127213]
    // smoothedLogLikelihoods: (2) [1.2261544859527942, -12.588834651813853]
    // smoothedNormalizedLikelihoods: (2) [0.9999989994794449, 0.0000010005205551183859]

    // this.decoder = new XmmProcessor();
    this.decoder = null;
    this.overrideLikeliest = false;

    // @todo - this should be related to module options, not to the session
    this.unsubscribeSession = this.graph.session.subscribe(updates => {
      if ('model' in updates) {
        const model = this.graph.session.get('model');
        const learningConfig = this.graph.session.get('learningConfig').payload;

        if (learningConfig.modelType ==='gmm') {
          this.decoder = xmm.MulticlassGMMPredictor(model, learningConfig.likelihoodWindow);
        } else if (learningConfig.modelType === 'hhmm') {
          this.decoder = xmm.HierarchicalHMMPredictor(model, learningConfig.likelihoodWindow);
        } else {
          console.error(`MLDecoder undefined model type ${learningConfig.modelType}, should be gmm or hhmm`);
        }
      }
    }, true);

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
  }

  destroy() {
    this.unsubscribeSession();
    this.unsubscribePlayer();
  }

  execute(inputFrame) {
    this.decoder.predict(inputFrame.data);
    this.outputFrame.data[this.id] = this.decoder.results;

    if (this.overrideLikeliest === true) {
      this.outputFrame.data[this.id].likeliest = this.graph.player.get('label');
    }

    // testing
    // this.outputFrame.data[this.id] = {}
    // this.outputFrame.data[this.id].likeliest = this.graph.player.get('label');

    return this.outputFrame;
  }
}

export default MLDecoder;
