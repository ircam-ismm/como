import { Bundle } from 'node-osc';
import { isPlainObject } from '@ircam/sc-utils';

// This is node only !!

/**
 * @param {Object} json JSON comote frame
 * @returns {Array|Bundle} Osc bundle from node-osc package, cf. https://www.npmjs.com/package/node-osc
 */
export function jsonToOsc(json, {
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
      json.absoluteorientation.quaternion.x,
      json.absoluteorientation.quaternion.y,
      json.absoluteorientation.quaternion.z,
      json.absoluteorientation.quaternion.w,
      json.absoluteorientation.quaternion.timestamp,
      json.absoluteorientation.quaternion.frequency,
    ]);

    bundle.push([
      `${addressPrefix}/absoluteorientation/euler`,
      json.absoluteorientation.euler.alpha,
      json.absoluteorientation.euler.beta,
      json.absoluteorientation.euler.gamma,
      json.absoluteorientation.euler.timestamp,
      json.absoluteorientation.euler.frequency,
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

// store previous bundle timestamp to estimate frequency
const previousBundleTimestamp = new Map();

export function getSourceAndIdFromBundle(bundle) {
  const address = bundle.elements[0][0];
  const parts = address.substring(1).split('/');
  const source = parts[0];
  const id = parts[2];
  return { source, id };
}

export function resetPreviousBundleTimestamp(id) {
  previousBundleTimestamp.delete(id);
}

/**
 * @param {Object} bundle Osc bundle from node-osc package, cf. https://www.npmjs.com/package/node-osc
 * @returns JSON comote frame
 */
export function oscToJson(bundle, {
  useBno055 = false,
} = {}) {
  // grab first element of bundle to get the source, id and timestamp
  const { source, id } = getSourceAndIdFromBundle(bundle);
  const addressPrefix = `/${source}/v3/${id}`;

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
  let timestamp;
  let frequency;
  const accMsg = bundle.elements.find(el => el[0] === `${addressPrefix}/accelerometer`);
  let frequencyEstimated;

  if (accMsg.length === 5) {
    frequencyEstimated = true;
    const first = bundle.elements[0];
    timestamp = first[first.length - 1];

    if (!previousBundleTimestamp.has(id)) {
      previousBundleTimestamp.set(id, timestamp);
      return null;
    }

    const prevTimestamp = previousBundleTimestamp.get(id);
    const dt = (timestamp - prevTimestamp) / 1000;
    frequency = 1 / dt;

    previousBundleTimestamp.set(id, timestamp);
  } else if (accMsg.length === 6) {
    frequencyEstimated = false;
    timestamp = first[first.length - 2];
    frequency = first[first.length - 1];
  }

  const json = {
    source,
    format: 'v3',
    id,
    timestamp, // not documented in spec, but comote sends it...
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

        json.absoluteorientation.quaternion = {
          x: el[1],
          y: el[2],
          z: el[3],
          w: el[4],
          timestamp: el[5],
          frequency: el[6] || frequency,
        };
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
          timestamp: el[4],
          frequency: el[5] || frequency,
        };
        break;
      }
      case `${addressPrefix}/bno055/quaternion`: {
        if (!useBno055) {
          break;
        }

        if (!isPlainObject(json.absoluteorientation)) {
          json.absoluteorientation = {};
        }

        json.absoluteorientation.quaternion = {
          x: el[1],
          y: el[2],
          z: el[3],
          w: el[4],
          timestamp: el[5],
          frequency: el[6] || frequency,
        };
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
          timestamp: el[4],
          frequency: el[5] || frequency,
        };
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
}
