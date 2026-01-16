import { Bundle } from 'node-osc';
import { isPlainObject } from '@ircam/sc-utils';
import {
  unsignedInt12BitToNormalised,
  unsignedInt14BitToNormalised,
  temperatureRawToCelsius as riotTemperatureToCelsius,
  batteryRawToVolts as riotBatteryRawToVolts,
  magnetometerV1ToGauss as riotMagnetometerV1ToGauss,
} from './riot.js';
import { apiConvert } from '@ircam/sc-motion/format.js';

// This is node only !!

/**
 * @param {Object} json JSON comote frame
 * @returns {Array|Bundle} Osc bundle from node-osc package, cf. https://www.npmjs.com/package/node-osc
 */
export function jsonToOscBundle(json, {
  asNodeOscBundle = false,
} = {}) {
  const addressPrefix = `/${json.source}/v3/${json.id}`;
  const bundle = [];

  if (isPlainObject(json.accelerometer)) {
    bundle.push([
      `${addressPrefix}/accelerometer`,
      json.accelerometer.x,
      json.accelerometer.y,
      json.accelerometer.z,
      json.accelerometer.timestamp,
      json.accelerometer.frequency,
    ]);
  }

  if (isPlainObject(json.gyroscope)) {
    bundle.push([
      `${addressPrefix}/gyroscope`,
      json.gyroscope.x,
      json.gyroscope.y,
      json.gyroscope.z,
      json.gyroscope.timestamp,
      json.gyroscope.frequency,
    ]);
  }

  if (isPlainObject(json.gravity)) {
    bundle.push([
      `${addressPrefix}/gravity`,
      json.gravity.x,
      json.gravity.y,
      json.gravity.z,
      json.gravity.timestamp,
      json.gravity.frequency,
    ]);
  }

  if (isPlainObject(json.magnetometer)) {
    bundle.push([
      `${addressPrefix}/magnetometer`,
      json.magnetometer.x,
      json.magnetometer.y,
      json.magnetometer.z,
      json.magnetometer.timestamp,
      json.magnetometer.frequency,
    ]);
  }

  if (isPlainObject(json.barometer)) {
    bundle.push([
      `${addressPrefix}/barometer`,
      json.barometer.pressure,
      json.barometer.relativeAltitude,
      json.barometer.timestamp,
      json.barometer.frequency,
    ]);
  }

  if (isPlainObject(json.heading)) {
    bundle.push([
      `${addressPrefix}/heading`,
      json.heading.magnetic,
      json.heading.geographic,
      json.heading.accuracy,
      json.heading.timestamp,
      json.heading.frequency,
    ]);
  }

  if (isPlainObject(json.absoluteorientation)) {
    bundle.push([
      `${addressPrefix}/absoluteorientation/quaternion`,
      json.absoluteorientation.quaternion[0],
      json.absoluteorientation.quaternion[1],
      json.absoluteorientation.quaternion[2],
      json.absoluteorientation.quaternion[3],
      json.absoluteorientation.timestamp,
      json.absoluteorientation.frequency,
    ]);

    bundle.push([
      `${addressPrefix}/absoluteorientation/euler`,
      json.absoluteorientation.euler.alpha,
      json.absoluteorientation.euler.beta,
      json.absoluteorientation.euler.gamma,
    ]);
  }

  if (isPlainObject(json.battery)) {
    const message = [
      `${addressPrefix}/battery`,
      json.battery.level,
    ];

    if ('charging' in json.battery) {
      message.push(json.battery.charging);

      if ('chargingTime' in json.battery) {
        message.push(json.battery.chargingTime);

        if ('dischargingTime' in json.battery) {
          message.push(json.battery.dischargingTime);
        }
      }
    }

    message.push(json.battery.timestamp);
    message.push(json.battery.frequency);

    bundle.push(message);
  }

  if (isPlainObject(json.control)) {
    for (let key in json.control) {
      if (key === 'timestamp') {
        continue;
      }

      bundle.push([
        `${addressPrefix}/control/${key}`,
        ...json.control[key],
        json.control.timestamp,
      ]);
    }
  }


  if (asNodeOscBundle) {
    return new Bundle(...bundle);
  }

  return bundle;
}

export function getMetaFromBundle(bundle) {
  const address = bundle.elements[0][0];
  const parts = address.substring(1).split('/');
  let [source, api, id] = parts;
  if (api !== 'v3') {
    if (source === 'comote') {
      api = 'comote-v2';
      id = parts[1];
    }
  }
  return { source, api, id };
}

export function getMetaFromMessage(message) {
  const address = message[0];
  const parts = address.substring(1).split('/');
  const [id, prefix] = parts;

  let api = 'unsupported';
  if (prefix === 'raw') {
    // length including address
    switch (message.length) {
      case 23:
        api = 'riot-v2-bitalino';
        break;

      case 21:
        api = 'riot-v2-ircam';
        break;

      case 13:
        api = 'riot-v1';
        break;
    }

  }

  return { api, id };
}

/**
 * @param {Object} bundle Osc bundle from node-osc package, cf. https://www.npmjs.com/package/node-osc
 * @returns JSON comote frame
 */
export function oscBundleToJson(bundle, {
  timestampUpdate,
  useBno055 = true,
} = {}) {
  // grab first element of bundle to get the source, id and timestamp
  const { source, api, id } = getMetaFromBundle(bundle);

  switch (api) {

    case 'v3': {

      const addressPrefix = `/${source}/${api}/${id}`;

      // make sure bno55 exists in frame, else fallback to regular absoluteorientation
      if (useBno055) {
        const entryExists = bundle.elements.find(el => el[0].startsWith(`${addressPrefix}/bno055`));
        // no bno055 entry found - fallback to regular absoluteorientation
        if (!entryExists) {
          useBno055 = false;
        }
      }

      // @todo: there is no frequency in the bundle sent by riot for now
      // grab accelerometer and check size to see if we have a frequency
      const accMsg = bundle.elements.find(el => el[0] === `${addressPrefix}/accelerometer`);
      const first = bundle.elements[0];
      let timestamp;
      let frequency;
      let frequencyEstimated;

      if (accMsg.length === 5) {
        frequencyEstimated = true;
        timestamp = first[first.length - 1];

        ({ frequency } = timestampUpdate({ timestamp }));
        if (!frequency) {
          return null;
        }
      } else if (accMsg.length === 6) {
        frequencyEstimated = false;
        timestamp = first[first.length - 2];
        frequency = first[first.length - 1];
      }

      const json = {
        source,
        api: 'v3',
        id,
        timestamp, // not documented in spec, but comote sends it...
        frequency,
      };

      bundle.elements.forEach(el => {
        const address = el[0];

        // fixed addresses
        switch (address) {
          case `${addressPrefix}/accelerometer`: {
            json.accelerometer = {
              x: el[1],
              y: el[2],
              z: el[3],
              timestamp: el[4],
              frequency: el[5] || frequency,
            };
            break;
          }
          case `${addressPrefix}/gyroscope`: {
            json.gyroscope = {
              x: el[1],
              y: el[2],
              z: el[3],
              timestamp: el[4],
              frequency: el[5] || frequency,
            };
            break;
          }
          case `${addressPrefix}/gravity`: {
            json.gravity = {
              x: el[1],
              y: el[2],
              z: el[3],
              timestamp: el[4],
              frequency: el[5] || frequency,
            };
            break;
          }
          case `${addressPrefix}/magnetometer`: {
            json.magnetometer = {
              x: el[1],
              y: el[2],
              z: el[3],
              timestamp: el[4],
              frequency: el[5] || frequency,
            };
            break;
          }
          case `${addressPrefix}/barometer`: {
            json.barometer = {
              pressure: el[1],
              relativeAltitude: el[2],
              timestamp: el[3],
              frequency: el[4] || frequency,
            };
            break;
          }
          case `${addressPrefix}/heading`: {
            json.heading = {
              magnetic: el[1],
              geographic: el[2],
              accuracy: el[3],
              timestamp: el[4],
              frequency: el[5] || frequency,
            };
            break;
          }
          case `${addressPrefix}/absoluteorientation/quaternion`: {
            if (useBno055) {
              break;
            }

            if (!isPlainObject(json.absoluteorientation)) {
              json.absoluteorientation = {};
            }

            json.absoluteorientation.quaternion = [
              el[1],
              el[2],
              el[3],
              el[4],
            ];
            json.absoluteorientation.timestamp = el[5];
            json.absoluteorientation.frequency = el[6] || frequency;
            break;
          }
          case `${addressPrefix}/absoluteorientation/euler`: {
            if (useBno055) {
              break;
            }

            if (!isPlainObject(json.absoluteorientation)) {
              json.absoluteorientation = {};
            }

            json.absoluteorientation.euler = {
              alpha: el[1],
              beta: el[2],
              gamma: el[3],
            };
            json.absoluteorientation.timestamp = el[4];
            json.absoluteorientation.frequency = el[5] || frequency;
            break;
          }
          case `${addressPrefix}/bno055/quaternion`: {
            if (!useBno055) {
              break;
            }

            if (!isPlainObject(json.absoluteorientation)) {
              json.absoluteorientation = {};
            }

            json.absoluteorientation.quaternion = [
              el[1],
              el[2],
              el[3],
              el[4],
            ];
            json.absoluteorientation.quaternion.timestamp = el[5];
            json.absoluteorientation.quaternion.frequency = el[6] || frequency;
            break;
          }
          case `${addressPrefix}/bno055/euler`: {
            if (!useBno055) {
              break;
            }

            if (!isPlainObject(json.absoluteorientation)) {
              json.absoluteorientation = {};
            }

            json.absoluteorientation.euler = {
              alpha: el[1],
              beta: el[2],
              gamma: el[3],
            };
            json.absoluteorientation.timestamp = el[4];
            json.absoluteorientation.frequency = el[5] || frequency;
            break;
          }
          case `${addressPrefix}/battery`: {
            const clone = [...el]; // do not modify input value
            clone.shift(); // remove address from array
            json.battery = {};
            // remove last params first as first ones are optional
            json.battery.frequency = frequencyEstimated ? frequency : clone.pop();
            json.battery.timestamp = clone.pop();

            json.battery.level = clone.shift();
            if (clone.length > 0) {
              json.battery.charging = clone.shift();
            }
            if (clone.length > 0) {
              json.battery.chargingTime = clone.shift();
            }
            if (clone.length > 0) {
              json.battery.dischargingTime = clone.shift();
            }
            break;
          }
        }

        if (address.startsWith(`${addressPrefix}/control/`)) {
          if (!isPlainObject(json.control)) {
            json.control = {};
          }

          const clone = [...el];  // do not modify input value
          const key = address.replace(`${addressPrefix}/control/`, '');
          clone.shift(); // remove address field
          const timestamp = clone.pop();
          const values = clone;

          json.control[key] = values;
          json.control.timestamp = timestamp;
        }
      });

      return json;
    } // api: 'v3'

    default: {
      throw new Error(`oscBundleToJson: unsupported api type "${api}"`);
    }
  }

}

export function oscMessageToJson(message, {
  timestampUpdate,
}) {
  let json = null;

  const { api, id } = getMetaFromMessage(message);

  const { timestamp, frequency } = timestampUpdate();

  if (!frequency) {
    return null;
  }

  switch (api) {
    case 'riot-v2-bitalino': {
      json = {
        source: 'riot',
        api,
        id,
        timestamp,
        frequency,
      };

      json.accelerometer = {
        x: message[1],
        y: message[2],
        z: message[3],
        timestamp,
        frequency,
      };

      json.gyroscope = {
        alpha: message[4],
        beta: message[5],
        gamma: message[6],
        timestamp,
        frequency,
      };

      json.magnetometer = {
        x: message[7],
        y: message[8],
        z: message[9],
        timestamp,
        frequency,
      };

      json.thermometer = {
        temperature: riotTemperatureToCelsius(message[10]),
        timestamp,
        frequency,
      };

      json.control = {
        button1: message[11],
        button2: message[12],
        analog1: unsignedInt12BitToNormalised(message[13]),
        analog2: unsignedInt12BitToNormalised(message[14]),
        timestamp,
      };

      json.absoluteorientation = {
        quaternion: message.slice(15, 15 + 4), // w, x, y, z as [q0, q1, q2, q3]

        euler: {
          alpha: message[19], // deg (yaw)
          beta: message[20], // deg (pitch)
          gamma: message[21], // deg (roll)
        },

        timestamp,
        frequency,
      };

      json.heading = {
        magnetic: message[22],
        timestamp,
        frequency,
      };

      break;
    }

    case 'riot-v2-ircam': {
      json = {
        source: 'riot',
        api,
        id,
        timestamp,
        frequency,
      };

      json.battery = {
        level: riotBatteryRawToVolts(message[1]),
        timestamp,
        frequency,
      };

      json.control = {
        button1: message[2],
        timestamp,
      };

      json.accelerometer = {
        x: message[3],
        y: message[4],
        z: message[5],
        timestamp,
        frequency,
      };

      json.gyroscope = {
        alpha: message[6],
        beta: message[7],
        gamma: message[8],
        timestamp,
        frequency,
      };

      json.magnetometer = {
        x: message[9],
        y: message[10],
        z: message[11],
        timestamp,
        frequency,
      };

      json.thermometer = {
        temperature: riotTemperatureToCelsius(message[12]),
        timestamp,
        frequency,
      };

      json.absoluteorientation = {
        quaternion: message.slice(13, 13 + 4), // w, x, y, z as [q0, q1, q2, q3]
        euler: {
          alpha: message[17], // deg (yaw)
          beta: message[18], // deg (pitch)
          gamma: message[19], // deg (roll)
        },
        timestamp,
        frequency,
      };

      json.heading = {
        magnetic: message[20],
        timestamp,
        frequency,
      };

      break;
    }

    case 'riot-v1': {
      json = {
        source: 'riot',
        api,
        id,
        timestamp,
        frequency,
      };

      json.battery = {
        level: riotBatteryRawToVolts(message[1]),
        timestamp,
        frequency,
      };

      json.control = {
        button1: message[2],
        timestamp,
      };

      json.accelerometer = {
        x: unsignedInt12BitToNormalised(message[3]),
        y: unsignedInt12BitToNormalised(message[4]),
        z: unsignedInt12BitToNormalised(message[5]),
        timestamp,
        frequency,
      };

      json.gyroscope = {
        alpha: unsignedInt14BitToNormalised(message[6]),
        beta: unsignedInt14BitToNormalised(message[7]),
        gamma: unsignedInt14BitToNormalised(message[8]),
        timestamp,
        frequency,
      };

      json.magnetometer = {
        x: riotMagnetometerV1ToGauss(message[9]),
        y: riotMagnetometerV1ToGauss(message[10]),
        z: riotMagnetometerV1ToGauss(message[11]),
        timestamp,
        frequency,
      };

      break;
    }

    default: {
      throw new Error(`oscMessageToJson: unsupported api type "${api}"`);
    }
  }

  return apiConvert({
    ...json,
    outputApi: 'v3',
  });
}
