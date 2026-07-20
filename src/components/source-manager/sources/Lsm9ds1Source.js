import { Worker } from 'node:worker_threads';
import AbstractSource from './AbstractSource.js';


const DEFAULT_INTERVAL_MS = 10; // ms ---> 100 Hz by default
const DEFAULT_ACTIVE_TIMEOUT_MS= 500;

function getTransferTimeMs() {
  return performance.timeOrigin + performance.now();
}


class Lsm9ds1Source extends AbstractSource {
  static type = 'lsm9ds1';

  #config = null;
  #worker = null;
  #activeTimeoutId = null;
  #activeTimeoutPeriod = null;


  constructor(como, config) {
    super(como);

    this.#config = config;

  }


  async init() {
    const interval = this.#config.interval || DEFAULT_INTERVAL_MS;
    const state = await this.como.stateManager.create(`${this.como.sourceManager.name}:source`, {
      id: this.#config.id || 'lsm9ds1',
      type: Lsm9ds1Source.type,
      nodeId: this.como.nodeId,
      infos: {
        id: this.#config.id || 'lsm9ds1',
        interval,
        worker: true,
      },
    });

    super.init(state);

    this.#activeTimeoutPeriod = DEFAULT_ACTIVE_TIMEOUT_MS;
    this.#startWorker(interval);

    console.log('LSM9DS1 worker acquisition started...');

    return true;
  }



  async delete() {

    if (this.#worker) {
      this.#worker.postMessage({
        type: 'stop',
      });

      await this.#worker.terminate();
      this.#worker = null;
    }

    if (this.#activeTimeoutId !== null) {
      clearTimeout(this.#activeTimeoutId);
      this.#activeTimeoutId = null;
    }

    await this.state.delete();
  }



  #startWorker(interval) {

    const workerURL = new URL(
      './Lsm9ds1Worker.js',
      import.meta.url,

    );

    this.#worker = new Worker(workerURL, {
      type: 'module',
      workerData: {
        id: this.#config.id || 'lsm9ds1',
        interval,
        verbose: Boolean(this.#config.verbose),
      },

    });

    this.#worker.on('message', message => {
      if (!message || typeof message !== 'object') {
        return;
      }

      if (message.type === 'ready') {
        console.log('LSM9DS1 worker ready');
        return;
      }

      if (message.type === 'log') {
        console.log(`[LSM9DS1 worker] ${message.message}`);
        return;
      }

      if (message.type === 'error') {
        console.error(`[LSM9DS1 worker] ${message.message}`);

        if (this.state && this.state.get('active')) {
          this.state.set({
            active: false,
          });
        }

        return;
      }

      if (message.type === 'frame') {
        this.#handleWorkerFrame(message.frame);
      }
    });

    this.#worker.on('error', error => {
      console.error('LSM9DS1 worker error:', error);

      if (this.state && this.state.get('active')) {
        this.state.set({
          active: false,
        });
      }
    });

    this.#worker.on('exit', code => {
      this.#worker = null;

      if (code !== 0) {
        console.error(`LSM9DS1 worker stopped with exit code ${code}`);

      } else if (this.#config.verbose) {
        console.log('LSM9DS1 worker stopped');
      }

      if (this.state && this.state.get('active')) {
        this.state.set({
          active: false,
        });
      }

    });

  }



  #handleWorkerFrame(data) {

    if (!data || !this.state) {
      return;
    }

    const mainThreadReceiveTimestamp = getTransferTimeMs(); // Time when the worker's frame is received
    data.mainThreadReceiveTimestamp = mainThreadReceiveTimestamp;


    if (Number.isFinite(data.workerPostTimestamp)) {
      data.workerToMainDurationMs = mainThreadReceiveTimestamp - data.workerPostTimestamp; // Time between worker's send and main thread's receptions of the frame
    }


    clearTimeout(this.#activeTimeoutId);

    if (!this.state.get('active')) {
      this.state.set({
        active: true,
      });
    }

    this.#activeTimeoutId = setTimeout(() => {

      if (this.state) {
        this.state.set({
          active: false,
        });
      }
    }, this.#activeTimeoutPeriod);

    this.state.set({
      frame: [data],
    });
  }
}

export default Lsm9ds1Source;


