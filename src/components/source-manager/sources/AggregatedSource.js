import AbstractSource from './AbstractSource.js';

export default class AggregatedSource extends AbstractSource {
  static type = 'aggregated';

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

  async init() {
    for (let [index, id] of this.#config.sources.entries()) {
      const source = await this.como.sourceManager.getSource(id);
      source.onUpdate(updates => this.#onSourceUpdate(id, index, updates));
      this.#sources[index] = source;
    }

    const state = await this.como.stateManager.create(`${this.como.sourceManager.name}:source`, {
      id: this.#config.id,
      type: AggregatedSource.type,
      nodeId: this.como.nodeId,
      infos: {
        sources: this.#config.sources,
      }
    });

    super.init(state);
  }

  async delete() {
    for (let source of this.#sources) {
      // detach from sources that are not owned
      if (!source.isOwner) {
        source.delete();
      }
    }
    clearTimeout(this.#activeTimeoutId);

    await this.state.delete();
  }

  #onSourceUpdate(id, index, updates) {
    if (!('frame' in updates)) {
      return;
    }

    const isPrimary = this.#config.sources[0] === id;
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
        if (secondary) {
          secondary.forEach(channel => {
            channel.timestamp = timestamp;
            channel.frequency = frequency;
            aggregated.push(channel);
          });
        }
      }

      this.state.set({ frame: aggregated });
    } else {
      this.#secondaryFrames[index] = frame;
    }
  }
}
