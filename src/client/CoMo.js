// import path from 'path';
import serviceFileSystemFactory from '@soundworks/service-file-system/client';
import servicePlatformFactory from '@soundworks/service-platform/client';
import serviceCheckinFactory from '@soundworks/service-checkin/client';
import serviceAudioBufferLoaderFactory from '@soundworks/service-audio-buffer-loader/client';
import serviceSyncFactory from '@soundworks/service-sync/client';
import serviceScriptingFactory from '@soundworks/service-scripting/client';
import serviceLoggerFactory from '@soundworks/service-logger/client';

import devicemotion from '@ircam/devicemotion';
// sources
import DeviceMotion from './sources/DeviceMotion';
import RandomValues from './sources/RandomValues';
// import Network from './sources/Network';
// import Record from './sources/Record';

// import moduleList from './modules/module-list';
import sourceList from './sources/source-list';

import Project from './Project';

class CoMo {
  constructor(soundworksClient, audioContext = null) {
    // expose constructors of available sources and nodes
    this.sources = sourceList;
    // this.modules = moduleList; // @note - do not expose for now

    // register device motion feature
    servicePlatformFactory.addFeatureDefinition({
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

    this.client.registerService('platform', servicePlatformFactory, {
      features: [
        // @note - this syntax is ugly
        ['web-audio', audioContext],
        ['devicemotion']
      ],
    });

    this.client.registerService('checkin', serviceCheckinFactory);
    this.client.registerService('file-watcher', serviceFileSystemFactory);


    this.client.registerService('scripts-data', serviceScriptingFactory);
    this.client.registerService('scripts-audio', serviceScriptingFactory);

    // maybe have 2 sync services : 1 for audio, 1 for high precision
    // on androids devices, the resolution of the movement time stamp
    // can be really poor (~80ms on samsung A3)
    //
    this.client.registerService('sync', serviceSyncFactory, {
      getTimeFunction: () => audioContext.currentTime,
    }, ['platform']);

    this.client.registerService('logger', serviceLoggerFactory);

    // we don't want to block for whatever reason on first screen
    this.client.registerService('audio-buffer-loader', serviceAudioBufferLoaderFactory, {}, ['platform']);

    this.audioContext = audioContext;

    if (audioContext) {
      this.audioMaster = audioContext.destination;
    }
  }

  async init(config) {
    return Promise.resolve(true);
  }

  async start() {
    this.project = new Project(this);
    await this.project.init();

    return Promise.resolve(true);
  }

  configureExperience(experience, enableServices = {}) {
    this.experience = experience;
    this.experience.services = {};

    const services = [
      // 'file-watcher', // we don't need that client-side
      'sync',
      'platform',
      'checkin',
      'audio-buffer-loader',
      'scripts-data',
      'scripts-audio',
      'logger',
    ];

    const servicesRequiringAudioContext = [
      'platform',
      'sync',
    ]

    services.forEach(serviceName => {
      if (!(serviceName in enableServices) || enableServices[serviceName] === true) {
        // check service that requires the audioContext
        if (
          servicesRequiringAudioContext.indexOf(serviceName) !== -1
          && this.audioContext === null
        ) {
          throw new Error(`service ${serviceName} requires a valid audioContext`);
        }

        this.experience.services[serviceName] = this.experience.require(serviceName);
      }
    });
  }
}

export default CoMo;

