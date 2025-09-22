import {
  counter,
  isPlainObject,
  isFunction,
} from '@ircam/sc-utils';
/**
 * Basically wrap 3 different states
 * - source
 * - script
 * - optional shared state defined in script
 */
const idGenerator = counter();

export default class Player {
  #como;
  #sourceId;
  #scriptName;
  #state;
  #source;

  #session = null;
  #script = null;
  #scriptState = null;
  // refs to clean up on script change
  #scriptModule = null;
  #scriptContext = null;
  #unsubscribeSource = null;

  static duplicate(playerState) {
    // not sure...
  }

  constructor(como, sourceId, scriptName = null) {
    this.#como = como;
    this.#sourceId = sourceId;
    this.#scriptName = scriptName;
  }

  get id() {
    return this.state.get('id');
  }

  get nodeId() {
    return this.state.get('nodeId');
  }

  get state() {
    return this.#state;
  }

  get source() {
    return this.#source;
  }

  get script() {
    return this.#script;
  }

  get scriptState() {
    return this.#scriptState;
  }

  async init() {
    if (!this.#como.sourceManager.sourceExists(this.#sourceId)) {
      throw new Error(`Cannot execute "createPlayer" on PlayerManager: source with id ${this.#sourceId} does not exists`);
    }

    this.#source = await this.#como.sourceManager.getSource(this.#sourceId);
    this.#state = await this.#como.stateManager.create(`${this.#como.playerManager.name}:player`, {
      id: `${this.#como.id}-${idGenerator()}`,
      nodeId: this.#como.nodeId,
      sourceId: this.source.get('id'),
    });

    await this.setScript(this.#scriptName);
  }

  async delete() {
    // delete the attached state, but not the "real" source
    if (!this.#source.isOwned) {
      await this.#source.detach();
    }
  }

  // ...

  async setScript(scriptName = null) {
    if (this.#script) {
      // delete shared state class
      if (this.#scriptState !== null) {
        // delete the state
        await this.#scriptState.detach();
        // delete the whole class
        const scriptSharedStateClassName = this.state.get('scriptSharedStateClassName');
        this.#como.requestRfc(
          this.#como.constants.SERVER_ID,
          `${this.#como.playerManager.name}:deleteSharedStateClass`,
          {
            className: scriptSharedStateClassName,
          }
        )

        this.#scriptState = null;
        await this.state.set({
          scriptSharedStateClassName: null,
          scriptSharedStateId: null,
        })
      }

      // delete script
      await this.#script.detach();
      this.#script = null;
      this.#scriptName = null;
      this.#scriptModule = null;
    }

    if (scriptName == null) {
      return;
    }

    const { promise, resolve, reject } = Promise.withResolvers();
    const script = await this.#como.scriptManager.attach(scriptName);
    let init = true;

    script.onUpdate(async updates => {
      if (this.#como.runtime === 'node' && !updates.nodeBuild) {
        reject(new Error(`Invalid script ${scriptName} for 'node' runtime: no node build found in script`));
      }

      if (this.#como.runtime === 'browser' && !updates.browserBuild) {
        reject(new Error(`Invalid script ${scriptName} for 'browser' runtime: no browser build found in script`));
      }

      if (this.#scriptModule && this.#scriptModule.exit) {
        try {
          this.#scriptModule.exit();
        } catch (err) {
          script.reportRuntimeError(err);
        }
      }

      this.#scriptModule = await script.import();
      // check script API contract
      if (this.#scriptModule.defineSharedState && !isFunction(this.#scriptModule.defineSharedState)) {
        const err = new Error(`Invalid script ${scriptName}: 'defineSharedState' export should be a function`);
        script.reportRuntimeError(err);
        reject(err);
      }

      if (this.#scriptModule.enter && !isFunction(this.#scriptModule.enter)) {
        const err = new Error(`Invalid script ${scriptName}: 'enter' export should be a function`);
        script.reportRuntimeError(err);
        reject(err);
      }

      if (this.#scriptModule.exit && !isFunction(this.#scriptModule.exit)) {
        const err = new Error(`Invalid script ${scriptName}: 'exit' export should be a function`);
        script.reportRuntimeError(err);
        reject(err);
      }

      if (this.#scriptModule.process && !isFunction(this.#scriptModule.process)) {
        const err = new Error(`Invalid script ${scriptName}: 'process' export should be a function`);
        script.reportRuntimeError(err);
        reject(err);
      }

      // create shared state for this script if any
      if (this.#scriptModule.defineSharedState) {
        const {
          classDescription,
          initValues = {},
        } = await this.#scriptModule.defineSharedState();

        if (!isPlainObject(classDescription)) {
          reject(new Error('Cannot execute "setScript" on Player: script "defineSharedState" return value should contains a valid "classDescription" field'));
        }

        const className = await this.#como.requestRfc(
          this.#como.constants.SERVER_ID,
          `${this.#como.playerManager.name}:defineSharedStateClass`,
          {
            scriptName,
            classDescription,
          }
        );

        this.#scriptState = await this.#como.stateManager.create(className, initValues);
      }

      // update player state
      await this.state.set({
        scriptSharedStateClassName: this.#scriptState.className,
        scriptSharedStateId: this.#scriptState.id,
      });

      this.#scriptContext = {
        como: this.#como,
        audioContext: this.#como.audioContext,
        sessionSoundFiles: '@todo - load session soundfiles',
        sharedState: this.#scriptState,
      };

      if (this.#scriptModule.enter) {
        this.#scriptModule.enter(this.#scriptContext);
      }

      this.#unsubscribeSource = this.#source.onUpdate(async updates => {
        if ('frame' in updates) {
          await this.#scriptModule.process(this.#scriptContext, updates.frame);
        }
      });

      if (init) {
        init = false;
        console.log('resolve setScript');
        resolve();
      }
    }, true);

    script.onDetach(async () => {
      this.#unsubscribeSource();

      if (this.#scriptModule.exit) {
        await this.#scriptModule.exit(this.#scriptContext);
      }
    });

    return promise;
  }
}
