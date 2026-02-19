import {
  counter,
  decibelToLinear,
  sleep,
  isFunction,
} from '@ircam/sc-utils';
import {
  GainNode
} from 'isomorphic-web-audio-api';
/**
 * Basically wrap 3 different states
 * - source
 * - script
 * - optional shared state defined in script
 * @private
 */
const idGenerator = counter();

/**
 * The `Player` class represents a full-featured player instance defined as a link
 * between a {@link ComoSource} and a {@link ComoScript}.
 *
 * A player is always instantiated on a given {@ComoNode}, although it si possible to
 * create a mirror of a Player on a different node.
 */
class Player {
  #como;
  #sourceId;
  #state;
  #source;

  #script = null; // the script instance from the plugin
  #scriptModule = null; // the JS module as imported from the script
  #scriptSharedState = null; // the shared state defined by the script
  #scriptContext = null; // Context object passed to all script public interface
  #scriptErrored = false; // Wether the script thrown an error during its lifetime
  #unsubscribeSource = null; // The subscription to the motion source
  #scriptLastState = null;

  #unsubscribeSession = null;
  // audio
  #muteNode;
  #volumeNode;
  #outputNode;
  #sessionSoundbank = null;

  /**
   * @hideconstructor
   * @param {*} como
   * @param {*} sourceId
   */
  constructor(como, sourceId) {
    // @todo - check arguments

    this.#como = como;
    this.#sourceId = sourceId;

    this.#muteNode = new GainNode(this.#como.audioContext);
    this.#volumeNode = new GainNode(this.#como.audioContext);
    this.#outputNode = new GainNode(this.#como.audioContext);
    this.#muteNode
      .connect(this.#volumeNode)
      .connect(this.#outputNode)
      .connect(this.#como.audioContext.destination);
  }

  /**
   * Id of the player
   * @type {String}
   */
  get id() {
    return this.state.get('id');
  }

  /**
   * Id of the como node
   * @type {String}
   */
  get nodeId() {
    return this.state.get('nodeId');
  }

  /**
   * Source of the player
   * @type {SharedState}
   */
  get source() {
    return this.#source;
  }

  /**
   * Underlying state of the player.
   * @type {SharedState}
   */
  get state() {
    return this.#state;
  }

  /**
   * Reconnect output node to destination.
   * Allows to have a script running outside a session.
   * @private
   */
  #reconnectDestination() {
    // re-connect
    const fadeInTime = this.#como.audioContext.currentTime;
    this.#outputNode.connect(this.#como.audioContext.destination);
    this.#outputNode.gain.setValueAtTime(0, fadeInTime);
    this.#outputNode.gain.linearRampToValueAtTime(1, fadeInTime + 0.01);
  }

  /** @private */
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
          case 'scriptName': {
            await this.setScript(value);
            break;
          }
          case 'sessionId': {
            await this.state.set({ sessionLoading: true });
            const sessionId = value;

            // disconnect from current output, be it a session bus or the destination
            const fadeOutTime = this.#como.audioContext.currentTime;
            this.#outputNode.gain.setValueAtTime(1, fadeOutTime);
            this.#outputNode.gain.linearRampToValueAtTime(0, fadeOutTime + 0.01);
            await sleep(0.01);
            this.#outputNode.disconnect();

            if (this.#unsubscribeSession) {
              this.#unsubscribeSession();
            }

            if (sessionId === null) {
              this.#reconnectDestination();
              await this.state.set({ scriptName: null, sessionLoading: false });
              break; // nothing left to do
            }

            const session = this.#como.sessionManager.getSession(sessionId);

            if (!session) {
              console.log(`Cannot attach player ${this.state.get('id')} to session ${sessionId}: session does not exists`);
              this.#reconnectDestination();
              this.state.set({ scriptName: null, sessionId: null, sessionLoading: false });
              break;
            }

            // load session files
            this.#sessionSoundbank = await this.#como.sessionManager.getSessionSoundbank(sessionId);
            // load default script
            const defaultScript = session.get('defaultScript');
            await this.setScript(defaultScript);

            const sessionBus = this.#como.sessionManager.getSessionBus(sessionId);
            const fadeInTime = this.#como.audioContext.currentTime;
            // connect to session bus
            this.#outputNode.connect(sessionBus);
            this.#outputNode.gain.setValueAtTime(0, fadeInTime);
            this.#outputNode.gain.linearRampToValueAtTime(1, fadeInTime + 0.01);

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
                    await this.#reloadScript();
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

  /**
   * Delete the player
   */
  async delete() {
    // if the source is not owned we can delete it safely
    if (!this.#source.isOwned) {
      await this.#source.detach();
    }

    // Only delete "real" state, not attached ones.
    // They must still live in the stateManager collection.
    if (this.#state.isOwned) {
      await this.#state.delete();
    }
  }

  /**
   * Set the script associated to this player
   * @param {String} [scriptName=null] - Name of the script. If null just exit
   *  from current script.
   */
  async setScript(scriptName = null) {
    if (this.#state.get('scriptName') !== scriptName) {
      // Keep state in sync if method is called directly
      // Note that this will resolve after the onUpdate execution
      await this.#state.set('scriptName', scriptName);
      return;
    }

    if (this.#script) {
      await this.#releaseScript();
      await this.#script.detach();
    }

    this.#script = null;
    // explicitly set last state to null as we change the script
    this.#scriptLastState = null;

    if (scriptName == null) {
      return;
    }

    this.#script = await this.#como.scriptManager.attach(scriptName);
    this.#script.onUpdate(async updates => {
      if ('runtimeError' in updates && updates.runtimeError !== null) {
        // silently release the script, we don't want to pack up runtime errors
        console.log(updates.runtimeError);
        console.log('releasing script');
        this.#releaseScript({ silent: true });
        return;
      }

      // make sure the script actually changed to prevent infinite loops on error
      if (this.#como.runtime === 'node' && 'nodeBuild' in updates) {
        await this.#reloadScript();
      }

      if (this.#como.runtime === 'browser' && 'browserBuild' in updates) {
        await this.#reloadScript();
      }
    });

    return this.#reloadScript();
  }

  /** @private */
  async #releaseScript({ silent = false } = {}) {
    // stop listening from the source
    if (this.#unsubscribeSource) {
      this.#unsubscribeSource();
    }

    // exit current script
    // if no build was found, we may not have any script module
    if (this.#scriptModule && isFunction(this.#scriptModule.exit)) {
      // if we don't have any script context, this means that something
      // failed before enter so no need to exit
      try {
        await this.#scriptModule.exit(this.#scriptContext);
      } catch (err) {
        // if the script errored at its initialization, this is likely that
        // disconnect will crash too, so we almost ignore this error which may be
        // confusing for the user.
        if (!silent) {
          this.#script.reportRuntimeError(err);

          if (this.#scriptErrored) {
            console.log('> note that the script errored at its initialized, it is likely that you can ignore this error');
          }
        }
        // Note that we don't want to return at this point
      }
    }

    // fade out and disconnect audio output
    if (this.#scriptContext?.outputNode) {
      const now = this.#como.audioContext.currentTime;
      this.#scriptContext.outputNode.gain.setValueAtTime(1, now);
      this.#scriptContext.outputNode.gain.linearRampToValueAtTime(0, now + 0.01);

      await sleep(0.01 + 128 / this.#como.audioContext.sampleRate);

      this.#scriptContext.outputNode.disconnect();
    }

    // clean script shared state if any
    if (this.#scriptSharedState !== null) {
      await this.#scriptSharedState.delete();
      const scriptSharedStateClassName = this.state.get('scriptSharedStateClassName');

      // clean state
      await this.state.set({
        scriptSharedStateClassName: null,
        scriptSharedStateId: null,
      });

      // clean class
      this.#como.requestRfc(
        this.#como.constants.SERVER_ID,
        `${this.#como.playerManager.name}:deleteSharedStateClass`,
        { scriptSharedStateClassName }
      )
    }

    this.#scriptModule = null;
    this.#scriptSharedState = null;
    this.#scriptContext = null;
  }

  /** @private */
  async #reloadScript() {
    // keep current shared state values to maintain state after reload
    // note that when the script changes, this is explicitly set to null
    if (this.#scriptSharedState) {
      this.#scriptLastState = {
        description: this.#scriptSharedState.getDescription(),
        values: this.#scriptSharedState.getValues(),
      }
    }

    // release old version of the script
    await this.#releaseScript();

    // import script and check API
    try {
      this.#scriptModule = await this.#script.import();
    } catch (err) {
      this.#script.reportRuntimeError(err);
      this.#scriptErrored = true;
    }

    // return if no import was found
    if (this.#scriptModule === null) {
      return;
    }

    // check script API contract
    if (this.#scriptModule.defineSharedState && !isFunction(this.#scriptModule.defineSharedState)) {
      this.#script.reportRuntimeError(new Error(`Cannot execute script ${this.#script.name}: Invalid API: 'defineSharedState' is not a function`));
      this.#scriptErrored = true;
      return;
    }

    if (this.#scriptModule.enter && !isFunction(this.#scriptModule.enter)) {
      this.#script.reportRuntimeError(new Error(`Cannot execute script ${this.#script.name}: Invalid API: 'enter' is not a function`));
      this.#scriptErrored = true;
      return;
    }

    if (this.#scriptModule.exit && !isFunction(this.#scriptModule.exit)) {
      this.#script.reportRuntimeError(new Error(`Cannot execute script ${this.#script.name}: Invalid API: 'exit' is not a function`));
      this.#scriptErrored = true;
      return;
    }

    if (this.#scriptModule.process && !isFunction(this.#scriptModule.process)) {
      this.#script.reportRuntimeError(new Error(`Cannot execute script ${this.#script.name}: Invalid API: 'process' is not a function`));
      this.#scriptErrored = true;
      return;
    }

    // Handle script shared state
    // create shared state for this script if any
    if (this.#scriptModule.defineSharedState) {
      // 1. validate class description
      let {
        classDescription,
        initValues,
      } = await this.#scriptModule.defineSharedState();

      try {
        this.#como.stateManager.validateClassDescription(classDescription);
      } catch (err) {
        this.#script.reportRuntimeError(new Error(`Cannot execute script ${this.#script.name}: Invalid shared state definition: ${err.message}`));
        this.#scriptErrored = true;
        return;
      }

      // 2. define shared state class
      let className;
      try {
        className = await this.#como.requestRfc(
          this.#como.constants.SERVER_ID,
          `${this.#como.playerManager.name}:defineSharedStateClass`,
          {
            scriptName: this.#script.name,
            classDescription,
          }
        );
      } catch (err) {
        this.#script.reportRuntimeError(err);
        this.#scriptErrored = true;
        return;
      }

      // 3. merge init values from last script instance
      if (!initValues) {
        initValues = {};

        // if no init values have been explicitly defined in the script
        // try to propagate the values from last state instance to the new one
        if (this.#scriptLastState !== null) {
          for (let key in classDescription) {
            if (key in this.#scriptLastState.values) {
              // use value from last state only if default is the same
              if (classDescription[key].default === this.#scriptLastState.description[key].default) {
                initValues[key] = this.#scriptLastState.values[key];
              }
            }
          }
        }
      }

      // 4. create script shared state
      // @todo - Proxy this.#scriptSharedState to report runtime errors
      this.#scriptSharedState = await this.#como.stateManager.create(className, initValues);
      // override onUpdate to wrap given callbacks in a try catch block
      // const originalOnUpdate = this.#scriptSharedState.onUpdate;
      // this.#scriptSharedState.onUpdate = (callback, executeListener) => {
      //   const wrappedCallback = (...args) => {
      //     try {
      //       callback(...args);
      //     } catch (err) {
      //       this.#script.reportRuntimeError(err);
      //       this.#scriptErrored = true;
      //     }
      //   }

      //   return originalOnUpdate.call(this.#scriptSharedState, wrappedCallback, executeListener);
      // }


      // 5. propagate shared state infos
      this.#state.set({
        scriptSharedStateClassName: this.#scriptSharedState.className,
        scriptSharedStateId: this.#scriptSharedState.id,
      });
    }

    // Build audio graph for this script instance
    const outputNode = new GainNode(this.#como.audioContext, { gain: 0 });
    outputNode.connect(this.#muteNode);

    // create context object for this script instance
    this.#scriptContext = {
      output: outputNode,
      state: this.#scriptSharedState,
      soundbank: this.#sessionSoundbank,
      scriptName: this.#script.name,
    };

    // enter the script
    if (isFunction(this.#scriptModule.enter)) {
      try {
        await this.#scriptModule.enter(this.#scriptContext);
      } catch (err) {
        console.log(err.message.slice(0, 200));
        process.exit(0);
        // this.#script.reportRuntimeError(err);
        // this.#scriptErrored = true;
        // return;
      }
    }

    // subscribe to the player's motion source
    this.#unsubscribeSource = this.#source.onUpdate(async updates => {
      if ('frame' in updates) {
        if (isFunction(this.#scriptModule.process)) {
          try {
            this.#scriptModule.process(this.#scriptContext, updates.frame);
          } catch (err) {
            this.#script.reportRuntimeError(err);
            this.#scriptErrored = true;
            return;
          }
        }
      }
    });

    // fade in output
    const now = this.#como.audioContext.currentTime;
    outputNode.gain.setValueAtTime(0, now);
    outputNode.gain.linearRampToValueAtTime(1, now + 0.01);
  }
}

export default Player;
