
const timestamp = {
  unit: 'ms',
}

const frequency = {
  unit: 'Hz',
}


const accelerometer = {
  x: { unit: 'm/s^2', normalize: val => val / 9.81 };
  y: { unit: 'm/s^2', normalize: val => val / 9.81 };
  z: { unit: 'm/s^2', normalize: val => val / 9.81 };
};

// const gyroscope = {
//   fields: ['x', 'y', 'z'],
//   unit: 'rad/s',
//   normalize: val => val / (2 * Math.PI),
// };

// const magnetometer = {
//   fields: ['x', 'y', 'z'],
//   unit: 'μT',
//   normalize: val => val, // ??
// };

// const gravity = {
//   fields: ['x', 'y', 'z'],
//   unit: 'm/s^2',
//   normalize: val => val / 9.81,
// };

// const barometer: {
//     pressure, // hPa
//     relativeAltitude, // m (0 if not available)
//     timestamp, // ms
//     frequency, // hz
//   },

//   // not standardised, yet.
//   // See https://w3c.github.io/deviceorientation/spec-source-orientation.html#worked-example
//   heading: {
//     magnetic, // degrees (0 is magnetic north, 90 is east)
//     geographic, // degrees (0 is geographic north, 90 is east)
//     accuracy, // degrees, -1 for unknown
//     timestamp, // ms
//     frequency, // hz
//   },

// absoluteorientation: {
//   types: [{

//   }]
// }
