import {
  counter,
  decibelToLinear,
  delay,
  isFunction,
  isPlainObject,
} from '@ircam/sc-utils';
import {
  GainNode
} from 'isomorphic-web-audio-api';
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
  #state;
  #source;

  #script = null;
  #scriptState = null;
  #scriptLastState = null;
  // refs to clean up on script change
  #scriptModule = null;
  #scriptContext = null;
  #unsubscribeSource = null;
  #unsubscribeSession = null;
  // audio
  #muteNode;
  #volumeNode;
  #outputNode;
  #sessionSoundbank = null;


  constructor(como, sourceId) {
    // @todo - check arguments

    this.#como = como;
    this.#sourceId = sourceId;

    this.#muteNode = new GainNode(this.#como.audioContext);
    this.#volumeNode = new GainNode(this.#como.audioContext);
    this.#outputNode = new GainNode(this.#como.audioContext);
    this.#muteNode
      .connect(this.#volumeNode)
      .connect(this.#outputNode);
  }

  get id() {
    return this.state.get('id');
  }

  get nodeId() {
    return this.state.get('nodeId');
  }

  get source() {
    return this.#source;
  }

  get state() {
    return this.#state;
  }

  // get script() {
  //   return this.#script;
  // }

  // expose so that we can create remote interfaces
  // get scriptState() {
  //   return this.#scriptState;
  // }

  async init(withState = null) {
    if (!this.#como.sourceManager.sourceExists(this.#sourceId)) {
      throw new Error(`Cannot execute "createPlayer" on PlayerManager: source with id ${this.#sourceId} does not exists`);
    }

    this.#source = await this.#como.sourceManager.getSource(this.#sourceId);

    // this is the difference between "real" and "duplicated" clients
    if (withState) {
      this.#state = withState;
      this.#state.onDetach(async () => await this.delete());
    } else {
      this.#state = await this.#como.stateManager.create(`${this.#como.playerManager.name}:player`, {
        id: `${this.#como.id}-${idGenerator()}`,
        nodeId: this.#como.nodeId,
        sourceId: this.source.get('id'),
      });
    }

    this.state.onUpdate(async updates => {
      for (let [key, value] of Object.entries(updates)) {
        switch (key) {
          case 'sessionId': {
            await this.state.set({ sessionLoading: true });
            const sessionId = value;

            if (this.#unsubscribeSession) {
              this.#unsubscribeSession();
              // handle audio routing
              const now = this.#como.audioContext.currentTime;
              this.#outputNode.gain.setValueAtTime(1, now);
              this.#outputNode.gain.linearRampToValueAtTime(0, now + 0.01);
              await delay(10);
              this.#outputNode.disconnect();
            }

            if (sessionId === null) {
              await this.setScript(null);
              await this.state.set({ sessionLoading: false });
              break; // nothing left to do
            }

            const session = this.#como.sessionManager.getSession(sessionId);

            if (!session) {
              console.log(`Cannot attach player ${this.state.get('id')} to session ${sessionId}: session does not exists`);
              this.setScript(null);
              this.state.set({ sessionId: null, sessionLoading: false });
              break;
            }

            // load session files
            this.#sessionSoundbank = await this.#como.sessionManager.getSessionSoundbank(sessionId);
            // load default script
            const defaultScript = session.get('defaultScript');
            await this.setScript(defaultScript);

            const now = this.#como.audioContext.currentTime;
            const sessionBus = this.#como.sessionManager.getSessionBus(sessionId);
            // connect to session
            this.#outputNode.connect(sessionBus);
            this.#outputNode.gain.setValueAtTime(0, now);
            this.#outputNode.gain.linearRampToValueAtTime(1, now + 0.01);

            await this.state.set({ sessionLoading: false });

            // handle session changes that must propagate to the player script
            this.#unsubscribeSession = session.onUpdate(async updates => {
              for (let [name, value] of Object.entries(updates)) {
                switch (name) {
                  case 'defaultScript': {
                    await this.setScript(value);
                    break;
                  }
                  case 'soundbank': {
                    const sessionId = session.get('uuid');
                    this.#sessionSoundbank = await this.#como.sessionManager.getSessionSoundbank(sessionId);

                    try {
                      await this.#reloadScript();
                    } catch (err) {
                      this.#script.reportRuntimeError(err);
                    }
                  }
                }
              }
            });
            break;
          }
          case 'mute': {
            const gain = value ? 0 : 1;
            this.#muteNode.gain.setTargetAtTime(gain, this.#como.audioContext.currentTime, 0.003);
            break;
          }
          case 'volume': {
            const gain = decibelToLinear(value);
            this.#volumeNode.gain.setTargetAtTime(gain, this.#como.audioContext.currentTime, 0.003);
            break;
          }
        }
      }
    });
  }

  async delete() {
    // if the source is not owned we can delete it safely
    if (!this.#source.isOwned) {
      await this.#source.detach();
    }

    // only delete "real" state, not attached ones
    if (this.#state.isOwned) {
      await this.#state.delete();
    }
  }

  // async setSession(sessionId) {
  //   await this.state.set({ sessionId });
  // }

  async setScript(scriptName = null) {
    if (this.#script) {
      // delete shared state class
      if (this.#scriptState !== null) {
        // delete the whole shared state script
        const scriptSharedStateClassName = this.state.get('scriptSharedStateClassName');
        this.#como.requestRfc(
          this.#como.constants.SERVER_ID,
          `${this.#como.playerManager.name}:deleteSharedStateClass`,
          {
            className: scriptSharedStateClassName,
          }
        )

        await this.state.set({
          scriptName: null,
          scriptSharedStateClassName: null,
          scriptSharedStateId: null,
        });
      }

      this.#unsubscribeSource();
      // if no build was found, we may not have any script module
      if (this.#scriptModule && isFunction(this.#scriptModule.exit)) {
        // if we don't have any script context, this means that something
        // failed before enter so no need to exit
        if (this.#scriptContext) {
          try {
            await this.#scriptModule.exit(this.#scriptContext);
          } catch (err) {
            this.#script.reportRuntimeError(err);
          }
        }
      }

      await this.#script.detach();

      this.#script = null;
      this.#scriptModule = null;
      this.#scriptState = null;
      this.#scriptLastState = null;
    }

    if (scriptName == null) {
      return;
    }

    const { promise, resolve, reject } = Promise.withResolvers();
    let init = true;
    this.#script = await this.#como.scriptManager.attach(scriptName);

    this.#script.onUpdate(async updates => {
      console.log('!!!!! script updates');
      if (this.#como.runtime === 'node' && !updates.nodeBuild) {
        reject(new Error(`Invalid script ${scriptName} for 'node' runtime: no node build found in script`));
      }

      if (this.#como.runtime === 'browser' && !updates.browserBuild) {
        reject(new Error(`Invalid script ${scriptName} for 'browser' runtime: no browser build found in script`));
      }

      try {
        await this.#reloadScript();
      } catch (err) {
        this.#script.reportRuntimeError(err);
      }

      if (init) {
        init = false;
        resolve();
      }
    }, true);

    return promise;
  }

  async #reloadScript() {
    if (!this.#script) {
      return;
    }

    if (this.#unsubscribeSource) {
      this.#unsubscribeSource();
    }

    if (this.#scriptModule && isFunction(this.#scriptModule.exit)) {
      try {
        // retrieve current values of the state to propagate the to next update if possible
        if (this.#scriptState) {
          this.#scriptLastState = {
            values: this.#scriptState.getValues(),
            description: this.#scriptState.getDescription(),
          }
        }

        // if we don't have any script context, this means that something
        // failed before enter so no need to exit
        await this.#scriptModule.exit(this.#scriptContext);
      } catch (err) {
        this.#script.reportRuntimeError(err);
      }
    }

    if (this.#scriptContext?.outputNode) {
      this.#scriptContext.outputNode.disconnect();
    }

    this.#scriptModule = await this.#script.import();
    const scriptName = this.#script.name;

    // check script API contract
    if (this.#scriptModule.defineSharedState && !isFunction(this.#scriptModule.defineSharedState)) {
      const err = new Error(`Invalid script ${scriptName}: 'defineSharedState' export should be a function`);
      this.#script.reportRuntimeError(err);
      throw err;
    }

    if (this.#scriptModule.enter && !isFunction(this.#scriptModule.enter)) {
      const err = new Error(`Invalid script ${scriptName}: 'enter' export should be a function`);
      this.#script.reportRuntimeError(err);
      throw err;
    }

    if (this.#scriptModule.exit && !isFunction(this.#scriptModule.exit)) {
      const err = new Error(`Invalid script ${scriptName}: 'exit' export should be a function`);
      this.#script.reportRuntimeError(err);
      throw err;
    }

    if (this.#scriptModule.process && !isFunction(this.#scriptModule.process)) {
      const err = new Error(`Invalid script ${scriptName}: 'process' export should be a function`);
      this.#script.reportRuntimeError(err);
      throw err;
    }

    // create shared state for this script if any
    if (this.#scriptModule.defineSharedState) {
      let {
        classDescription,
        initValues = null,
      } = await this.#scriptModule.defineSharedState();

      if (!isPlainObject(classDescription)) {
        throw new Error('Cannot execute "setScript" on Player: script "defineSharedState" return value should contains a valid "classDescription" field');
      }

      let className;
      try {
        className = await this.#como.requestRfc(
          this.#como.constants.SERVER_ID,
          `${this.#como.playerManager.name}:defineSharedStateClass`,
          {
            scriptName,
            classDescription,
          }
        );
      } catch (err) {
        console.log(err);
        this.#script.reportRuntimeError(err);
        throw err;
      }

      // if no init values have been explicitly defined in the script
      // try to propagate the values from last state instance to the new one
      if (initValues === null && this.#scriptLastState !== null) {
        initValues = {};
        for (let key in classDescription) {
          if (key in this.#scriptLastState.values) {
            // use value from last state only if default is the same
            if (classDescription[key].default === this.#scriptLastState.description[key].default) {
              initValues[key] = this.#scriptLastState.values[key];
            }
          }
        }
      } else {
        initValues = {};
      }

      this.#scriptState = await this.#como.stateManager.create(className, initValues);
    }

    // update player state
    await this.state.set({
      scriptSharedStateClassName: this.#scriptState.className,
      scriptSharedStateId: this.#scriptState.id,
      scriptName,
    });

    // create an output per script execution
    const outputNode = new GainNode(this.#como.audioContext);
    outputNode.connect(this.#muteNode);

    this.#scriptContext = {
      como: this.#como,
      scriptName,
      audioContext: this.#como.audioContext,
      outputNode,
      soundbank: this.#sessionSoundbank,
      sharedState: this.#scriptState,
    };

    if (isFunction(this.#scriptModule.enter)) {
      await this.#scriptModule.enter(this.#scriptContext);
    }

    // everything is ready, pipe source into script
    this.#unsubscribeSource = this.#source.onUpdate(async updates => {
      if ('frame' in updates) {
        if (isFunction(this.#scriptModule.process)) {
          await this.#scriptModule.process(this.#scriptContext, updates.frame);
        }
      }
    });
  }
}
