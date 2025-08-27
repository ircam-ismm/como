import AbstractSource from './AbstractSource.js';

export default class AggregatedSource extends AbstractSource {
  static type = 'aggregated';

  #como;
  #config;
  #sources = [];
  #secondaryFrames;
  // @todo - make this more robust
  #activeTimeout = 100; // ms
  #activeTimeoutId;

  constructor(como, config) {
    super(como);

    this.#config = config;
    this.#secondaryFrames = {};
  }

  get id() {
    return this.#config.id
  }

  async init() {
    const state = await this.como.node.stateManager.create('source', {
      id: this.#config.sourceId,
      type: AggregatedSource.type,
      infos: {
        sources: this.#config.sources,
      }
    });

    super.init(state);


    for (let [index, sourceId] of this.#config.sources.entries()) {
      const source = await this.como.sourceManager.getSource(sourceId);
      source.onUpdate(updates => this.#onSourceUpdate(sourceId, index, updates));
    }
  }

  async delete() {
    for (let source of this.#sources) {
      await source.delete();
    }

    await this.state.delete();
  }

  #onSourceUpdate(sourceId, index, updates) {
    if (!('frame' in updates)) {
      return;
    }

    const isPrimary = this.#config.sources[0] === sourceId;
    const { frame } = updates;

    if (isPrimary) {
      clearTimeout(this.#activeTimeoutId);

      if (!this.state.get('active')) {
        this.state.set({ active: true });
      }

      this.#activeTimeoutId = setTimeout(() => {
        this.state.set({ active: false });
      }, this.#activeTimeout);
      // be careful here: we must be able to aggregate already aggregated source
      const aggregated = [...frame];

      for (let i = 1; i < this.#config.sources.length; i++) {
        const { timestamp, frequency } = frame[0];
        // @todo
        // - Define what to do with timestamp and frequency, for now just override at
        // top level of each frame
        // - What to do if we miss a secondary frame before sending
        // - Make more robust
        // - ...
        const secondary = this.#secondaryFrames[i];
        secondary.forEach(channel => {
          channel.timestamp = timestamp;
          channel.frequency = frequency;
          aggregated.push(channel);
        });

      }

      this.state.set({ frame: aggregated });
    } else {
      this.#secondaryFrames[index] = frame;
    }
  }
}
