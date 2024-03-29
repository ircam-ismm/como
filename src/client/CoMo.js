// import path from 'path';
import pluginFileSystemFactory from '@soundworks/plugin-filesystem/client';
import pluginPlatformFactory from '@soundworks/plugin-platform/client';
import pluginCheckinFactory from '@soundworks/plugin-checkin/client';
import pluginAudioBufferLoaderFactory from '@soundworks/plugin-audio-buffer-loader/client';
import pluginSyncFactory from '@soundworks/plugin-sync/client';
import pluginScriptingFactory from '@soundworks/plugin-scripting/client';
import pluginLoggerFactory from '@soundworks/plugin-logger/client';

import devicemotion from '@ircam/devicemotion';
import { Scheduler } from '@ircam/sc-scheduling';

import modules from './modules/index.js';
import sources from './sources/index.js';
import helpers from './helpers/index.js';

import Project from './Project.js';

class CoMo {
  constructor(soundworksClient, audioContext = null) {
    // expose constructors of available sources and nodes
    this.sources = sources;
    this.modules = modules;
    this.helpers = helpers;

    // register device motion feature
    pluginPlatformFactory.addFeatureDefinition({
      id: 'devicemotion',
      initialize: async () => {
        const result = await devicemotion.requestPermission();
        this.hasDeviceMotion = result === 'granted' ? true : false;
        // always return `true` as we don't want to block the application at
        // this point, this must be the application responsibility to display
        // an error message if the client requires `deviceMotion`
        return true;
      },
    })

    this.client = soundworksClient;

    this.client.pluginManager.register('platform', pluginPlatformFactory, {
      features: [
        // @note - this syntax is ugly
        ['web-audio', audioContext],
        ['devicemotion']
      ],
    });

    this.client.pluginManager.register('checkin', pluginCheckinFactory);
    this.client.pluginManager.register('filesystem', pluginFileSystemFactory);


    this.client.pluginManager.register('scripts-data', pluginScriptingFactory);
    this.client.pluginManager.register('scripts-audio', pluginScriptingFactory);

    // maybe have 2 sync plugins : 1 for audio, 1 for high precision
    // on androids devices, the resolution of the movement time stamp
    // can be really poor (~80ms on samsung A3)
    //
    this.client.pluginManager.register('sync', pluginSyncFactory, {
      getTimeFunction: () => performance.now() * 0.001,
    }, ['platform']);

    this.client.pluginManager.register('sync-audio', pluginSyncFactory, {
      getTimeFunction: () => audioContext.currentTime,
    }, ['platform']);

    this.client.pluginManager.register('logger', pluginLoggerFactory);

    // we don't want to block for whatever reason on first screen
    this.client.pluginManager.register('audio-buffer-loader', pluginAudioBufferLoaderFactory, {
      assetsDomain: this.client.config.env.assetsDomain,
    }, ['platform']);

    this.audioContext = audioContext;

    if (audioContext) {
      this.audioMaster = audioContext.destination;
    }
  }

  async init(config) {
    return Promise.resolve(true);
  }

  async start() {
    this.helpers.scheduler = new Scheduler(() => this.audioContext.currentTime);

    const sync = this.experience.plugins['sync-audio'];
    this.helpers.syncedScheduler = new Scheduler(() => sync.getSyncTime(), {
      currentTimeToAudioTimeFunction: currentTime => sync.getLocalTime(currentTime),
    });

    this.project = new Project(this);
    await this.project.init();

    return Promise.resolve(true);
  }

  configureExperience(experience, enableServices = {}) {
    this.experience = experience;
    this.experience.plugins = {};

    const plugins = [
      'filesystem',
      'sync',
      'sync-audio',
      'platform',
      'checkin',
      'audio-buffer-loader',
      'scripts-data',
      'scripts-audio',
      'logger',
    ];

    const pluginsRequiringAudioContext = [
      'platform',
      'sync-audio',
    ];

    plugins.forEach(pluginName => {
      if (!(pluginName in enableServices) || enableServices[pluginName] === true) {
        // check plugin that requires the audioContext
        if (
          pluginsRequiringAudioContext.indexOf(pluginName) !== -1
          && this.audioContext === null
        ) {
          throw new Error(`plugin ${pluginName} requires a valid audioContext`);
        }

        this.experience.plugins[pluginName] = this.experience.require(pluginName);
      }
    });
  }
}

export default CoMo;

