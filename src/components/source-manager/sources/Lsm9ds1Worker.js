import { parentPort, workerData } from 'node:worker_threads';
import { getTime } from '@ircam/sc-utils';
import { Gravity } from '@ircam/sc-motion';

// Conditional import: i2c is only available on Linux
// On Mac, we don't import the module to prevent the server from crashing
let I2C = null;
if (process.platform === 'linux') {
  const module = await import('i2c');
  I2C = module.default;
}


// --------- I2C Address ----------
const LSM9DS1_GYRO_ACCEL_ADDRESS = 0x6B; // I2C address of the gyroscope and accelerometer
const LSM9DS1_MAGNETO_ADDRESS    = 0x1E; // I2C address of the magnetometer


// ------- Gyroscope/Accelerometer Registers --------
const GYRO_ACCEL_REGISTER = {

  WHO_AM_I:     0x0F, // Gyroscope/Accelerometer identification register (== 0x68 by default)
  CTRL_REG8:    0x22, // Address auto-increment

  // ---  Gyroscope Register -----
  CTRL_REG1_G:  0x10, // ODR (Hz), gyroscope scale (dps)
  OUT_X_G:      0x18, // First gyroscope output register (OUT_X_L_G / X Low)

  // ---- Accelerometer Register ---
  CTRL_REG6_XL: 0x20, // ODR (Hz), accelerometer scale (g)
  OUT_X_XL:     0x28, // First accelerometer output register (OUT_X_L_XL / X Low)
};


// -------- Magnetometer Registers ----------
const MAGNETO_REGISTER = {
  WHO_AM_I_M:   0x0F, // Magnetometer identification register (== 0x3D by default)
  CTRL_REG1_M:  0x20, // ODR (Hz), XY-axis performance mode, temperature compensation
  CTRL_REG2_M:  0x21, // Magnetometer scale (gauss)
  CTRL_REG3_M:  0x22, // Continuous mode
  CTRL_REG4_M:  0x23, // Z-axis performance mode
  OUT_X_M:      0x28, // First magnetometer output register (OUT_X_L_M / X Low)
};



// -------- Unit Sensor Sensitivities -----------
const ACCEL_SENSIVITY = 0.000244; // g/LSB ---> ±8g
const GYRO_SENSIVITY = 0.07;     // dps/LSB --->  ±2000 dps
const MAGNETO_SENSIVITY = 0.00043; // gauss/LSB  ---->  ±12 gauss


// --------- Conversion factors ------------
const GAUSS_TO_UT = 100;   // ---> 1 gauss = 0.0001 Tesla (T), or 100 microTesla (uT)
const DEG_TO_RAD = Math.PI / 180;
const GRAV_TO_M_S_2 = 9.81;    // --->  1g = 9,81 m/s^2


const {
  id = 'lsm9ds1',
  interval = 10,
  verbose = false,
} = workerData || {};


const frequency = 1000 / interval;

const gravityProcessor = new Gravity({
  outputApi: 'v3',
  frequency,
});


let gyroAccelWire = null;
let magnetoWire = null;
let running = true;



function getTimeMs() {
  return getTime() * 1e3;
}

function getTransferTimeMs() {
  return performance.timeOrigin + performance.now();
}




// -------- Opening an I2C connection -------------
function openWire(address) {
  return new Promise((resolve, reject) => {
    const wire = new I2C(address, { device: '/dev/i2c-1' });

    wire.on('open', () => {
      resolve(wire);

    });

    wire.on('error', err => {
      reject(
        new Error(`I2C open 0x${address.toString(16)}: ${err}`),
      );
    });
  });

}


//--------- Reading from a register ------------
function readRegister(wire, register, length) {
  return new Promise((resolve, reject) => {
    wire.readBytes(register, length, (err, res) => {
      if (err) {
        reject(
          new Error(`readReg 0x${register.toString(16)}: ${err}`),
        );

      } else {
        resolve(res);
      }
    });
  });
}


//--------- Writing in a register ------------
function writeRegister(wire, register, value) {
  return new Promise((resolve, reject) => {
    wire.writeBytes(register, [value], err => {

      if (err) {
        reject(
          new Error(`writeReg 0x${register.toString(16)}: ${err}`),
        );

      } else {
        resolve();
      }
    });
  });
}



//------------ Sensor Initialization -------------
async function initSensor() {

  if (I2C === null) {
    throw new Error(
      'The I2C module is not available on this platform; the sensor is disabled.',
    );
  }

  gyroAccelWire = await openWire(LSM9DS1_GYRO_ACCEL_ADDRESS);
  magnetoWire = await openWire(LSM9DS1_MAGNETO_ADDRESS);

  const gyroAccelId = await readRegister(gyroAccelWire, GYRO_ACCEL_REGISTER.WHO_AM_I, 1);

  if (gyroAccelId[0] !== 0x68) {
    throw new Error(
      `LSM9DS1 gyroscope and accelerometer not detected `
      + `(WHO_AM_I=0x${gyroAccelId[0].toString(16)}, expected 0x68)`,
    );
  }

  if (verbose) {
    parentPort.postMessage({
      type: 'log',
      message: 'LSM9DS1 gyroscope and accelerometer identified',
    });
  }

  const magnetoId = await readRegister(magnetoWire, MAGNETO_REGISTER.WHO_AM_I_M, 1);

  if (magnetoId[0] !== 0x3D) {
    throw new Error(
      `LSM9DS1 magnetometer not detected `
      + `(WHO_AM_I=0x${magnetoId[0].toString(16)}, expected 0x3D)`,
    );
  }

  if (verbose) {
    parentPort.postMessage({
      type: 'log',
      message: 'LSM9DS1 magnetometer identified',
    });
  }

  // --------- Gyroscope and accelerometer settings ------------
  await writeRegister(gyroAccelWire, GYRO_ACCEL_REGISTER.CTRL_REG8, 0x04);
  await writeRegister(gyroAccelWire, GYRO_ACCEL_REGISTER.CTRL_REG1_G, 0x98);
  await writeRegister(gyroAccelWire, GYRO_ACCEL_REGISTER.CTRL_REG6_XL, 0x98);

  // ------------ Magnetometer settings --------------
  await writeRegister(magnetoWire, MAGNETO_REGISTER.CTRL_REG1_M, 0xFC);
  await writeRegister(magnetoWire, MAGNETO_REGISTER.CTRL_REG2_M, 0x40);
  await writeRegister(magnetoWire, MAGNETO_REGISTER.CTRL_REG3_M, 0x00);
  await writeRegister(magnetoWire, MAGNETO_REGISTER.CTRL_REG4_M, 0x0C);

  if (verbose) {
    parentPort.postMessage({
      type: 'log',
      message: 'LSM9DS1 sensor initialized',
    });
  }
}


//------------ Reading sensor data -----------
async function readSensor() {
  const frameCreationStartTimestamp = getTimeMs();

  if (gyroAccelWire === null || magnetoWire === null) {
    return null;
  }

  const gyroBuffer = await readRegister(gyroAccelWire, GYRO_ACCEL_REGISTER.OUT_X_G, 6);
  const accelBuffer = await readRegister(gyroAccelWire, GYRO_ACCEL_REGISTER.OUT_X_XL, 6);
  const magnetoBuffer = await readRegister(magnetoWire, MAGNETO_REGISTER.OUT_X_M, 6);

  const frameTimestampSeconds = getTime();
  const frameTimestamp = frameTimestampSeconds * 1e3;

  const data = {

    source: 'lsm9ds1',
    api: 'v3',
    id,
    timestamp: frameTimestamp,

    accelerometer: {
      x: accelBuffer.readInt16LE(2) * ACCEL_SENSIVITY * GRAV_TO_M_S_2,
      y: accelBuffer.readInt16LE(0) * ACCEL_SENSIVITY * GRAV_TO_M_S_2,
      z: accelBuffer.readInt16LE(4) * ACCEL_SENSIVITY * GRAV_TO_M_S_2,
      timestamp: frameTimestamp,
      frequency,
    },

    gyroscope: {
      x: gyroBuffer.readInt16LE(2) * GYRO_SENSIVITY * DEG_TO_RAD,
      y: gyroBuffer.readInt16LE(0) * GYRO_SENSIVITY * DEG_TO_RAD,
      z: gyroBuffer.readInt16LE(4) * GYRO_SENSIVITY * DEG_TO_RAD,
      timestamp: frameTimestamp,
      frequency,
    },

    magnetometer: {
      x: magnetoBuffer.readInt16LE(2) * MAGNETO_SENSIVITY * GAUSS_TO_UT,
      y: magnetoBuffer.readInt16LE(0) * MAGNETO_SENSIVITY * GAUSS_TO_UT,
      z: magnetoBuffer.readInt16LE(4) * MAGNETO_SENSIVITY * GAUSS_TO_UT,
      timestamp: frameTimestamp,
      frequency,
    },

  };

  data.gravity = gravityProcessor.process({
    api: data.api,
    accelerometer: data.accelerometer,
    gyroscope: data.gyroscope,
    timestamp: frameTimestampSeconds,
  });

  const frameCreationEndTimestamp = getTimeMs();
  data.frameCreationDurationMs = frameCreationEndTimestamp - frameCreationStartTimestamp; // Duration of frame creation

  return data;

}




//------------ Acquisition Loop -----------
async function acquisitionLoop() {

  let nextStamp = getTimeMs();

  parentPort.postMessage({
    type: 'ready',
  });

  while (running) {

    nextStamp += interval; // Target time for the next acquisition

    while (running && getTimeMs() < nextStamp) {} // Waiting interval

    if (!running) {
      break;
    }


    try {
      const frame = await readSensor();

      if (frame) {

        frame.workerPostTimestamp = getTransferTimeMs(); // Time when the worker send the frame to the main thread

        parentPort.postMessage({
          type: 'frame',
          frame,
        });
      }
    } catch (error) {
      parentPort.postMessage({
        type: 'error',
        message: error?.message || String(error),
      });
    }

  }
}

parentPort.on('message', message => {
  if (message?.type === 'stop') {
    running = false;
  }
});

try {
  await initSensor();
  await acquisitionLoop();
} catch (error) {

  parentPort.postMessage({
    type: 'error',
    message: error?.message || String(error),
  });
}
