import AbstractSource from './AbstractSource.js';
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
const ACCEL_SENSIVITY = 0.000061; // g/LSB ---> ±2g
const GYRO_SENSIVITY = 0.00875;     // dps/LSB --->  ±245 dps
const MAGNETO_SENSIVITY = 0.00014; // gauss/LSB  ---->  ±4 gauss



// --------- Conversion factors ------------
const GAUSS_TO_UT = 100;   // ---> 1 gauss = 0.0001 Tesla (T), or 100 microTesla (uT)
const DEG_TO_RAD = Math.PI / 180;
const GRAV_TO_M_S_2 = 9.81;    // --->  1g = 9,81 m/s^2


// ------ Reading Frequency -------
const DEFAULT_INTERVAL_MS = 10; // ms ---> 100 Hz by default
const DEFAULT_ACTIVE_TIMEOUT_MS= 500;



class Lsm9ds1Source extends AbstractSource {
  static type = 'lsm9ds1';

  #config = null;

  #gyroAccelWire = null;
  #magnetoWire = null;
  #intervalId = null;

  #activeTimeoutId = null;
  #activeTimeoutPeriod = null;

  #gravityProcessor = new Gravity({ outputApi: 'v3' });

  constructor(como, config) {
    super(como);

    this.#config = config;
  }

  async init() {
    const state = await this.como.stateManager.create(`${this.como.sourceManager.name}:source`, {
      id: this.#config.id || 'lsm9ds1',
      type: Lsm9ds1Source.type,
      nodeId: this.como.nodeId,
      infos: {
        id: this.#config.id || 'lsm9ds1',
        interval: this.#config.interval || DEFAULT_INTERVAL_MS,
      },
    });

    super.init(state);

    await this.#initSensor();

    const interval = this.#config.interval || DEFAULT_INTERVAL_MS;
    this.#activeTimeoutPeriod = DEFAULT_ACTIVE_TIMEOUT_MS;
    this.#intervalId = setInterval(() => this.#readSensor(), interval);
    console.log('Sensor reading in progress...');

    return true;
  }

  async delete() {

    if (this.#intervalId !== null) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
    }

    if (this.#activeTimeoutId !== null) {
      clearTimeout(this.#activeTimeoutId);
      this.#activeTimeoutId = null;
    }

    await this.state.delete();
  }



  // -------- Opening an I2C connection -------------
  #openWire(address) {
    return new Promise((resolve, reject) => {
      const wire = new I2C(address, { device: '/dev/i2c-1' });
      wire.on('open', () => resolve(wire));
      wire.on('error', (err) => reject(new Error(`I2C open 0x${address.toString(16)}: ${err}`)));
    });
  }


  //--------- Reading from a register ------------
  #readRegister(wire, register, length) {
    return new Promise((resolve, reject) => {
      wire.readBytes(register, length, (err, res) => {
        if (err) {
          reject(new Error(`readReg 0x${register.toString(16)}: ${err}`));
        } else {
          resolve(res);
        }
      });
    });
  }


  //--------- Writing in a register ------------
  #writeRegister(wire, register, value) {
    return new Promise((resolve, reject) => {
      wire.writeBytes(register, [value], (err) => {
        if (err) {
          reject(new Error(`writeReg 0x${register.toString(16)}: ${err}`));
        } else {
          resolve();
        }
      });
    });
  }


  //------------ Sensor Initialization -------------
  async #initSensor() {

    if (I2C === null) {
      console.warn('The I2C module is not available on this platform; the sensor is disabled.');
      return;
    }

    this.#gyroAccelWire = await this.#openWire(LSM9DS1_GYRO_ACCEL_ADDRESS);
    this.#magnetoWire = await this.#openWire(LSM9DS1_MAGNETO_ADDRESS);


    // WHO_AM_I gyroscope/accelerometer check (should return 0x68)
    const gyroAccelId = await this.#readRegister(this.#gyroAccelWire, GYRO_ACCEL_REGISTER.WHO_AM_I, 1);
    if (gyroAccelId[0] !== 0x68) {
      throw new Error(`LSM9DS1 gyroscope and accelerometer not detected (WHO_AM_I=0x${gyroAccelId[0].toString(16)}, attendu 0x68)`);
    }
    console.log('LSM9DS1 gyroscope and accelerometer identified');


    // WHO_AM_I magnetometer check (should return 0x3D)
    const magnetoId = await this.#readRegister(this.#magnetoWire, MAGNETO_REGISTER.WHO_AM_I_M, 1);
    if (magnetoId[0] !== 0x3D) {
      throw new Error(`LSM9DS1 magnetometer not detected (WHO_AM_I=0x${magnetoId [0].toString(16)}, attendu 0x3D)`);
    }
    console.log('LSM9DS1 Magnetometer identified');


    // --------- Gyroscope and Magnetometer Settings ------------
    await this.#writeRegister(this.#gyroAccelWire, GYRO_ACCEL_REGISTER.CTRL_REG8, 0x04); // Auto-incrementing address
    await this.#writeRegister(this.#gyroAccelWire, GYRO_ACCEL_REGISTER.CTRL_REG1_G, 0x80); // Gyroscope: ODR 238 Hz, ±245 dps
    await this.#writeRegister(this.#gyroAccelWire, GYRO_ACCEL_REGISTER.CTRL_REG6_XL, 0x80);  // Accelerometer: ODR 238 Hz, ±2g


    // ------------ Magnetometer Settings --------------
    await this.#writeRegister(this.#magnetoWire, MAGNETO_REGISTER.CTRL_REG1_M, 0xFC); // Ultra-high performance XY-axis, ODR 80 Hz, Temperature Compensation
    await this.#writeRegister(this.#magnetoWire, MAGNETO_REGISTER.CTRL_REG2_M, 0x00); // ±4 gauss
    await this.#writeRegister(this.#magnetoWire, MAGNETO_REGISTER.CTRL_REG3_M, 0x00); // Continuous mode
    await this.#writeRegister(this.#magnetoWire, MAGNETO_REGISTER.CTRL_REG4_M, 0x0C); // Ultra-high performance Z-axis


    console.log('LSM9DS1 sensor initialized');

  }



  //------------ Reading sensor data -----------
  #readSensor = async () => {

    if (this.#gyroAccelWire === null || this.#magnetoWire === null) {
      return;
    }


    try {
      const gyroBuffer = await this.#readRegister(this.#gyroAccelWire, GYRO_ACCEL_REGISTER.OUT_X_G, 6);
      const accelBuffer = await this.#readRegister(this.#gyroAccelWire, GYRO_ACCEL_REGISTER.OUT_X_XL, 6);
      const magnetoBuffer = await this.#readRegister(this.#magnetoWire, MAGNETO_REGISTER.OUT_X_M, 6);

      const now = getTime() * 1e3; // ms

      const data = {
        source: Lsm9ds1Source.type,
        api: 'v3',
        id: this.#config.id || 'lsm9ds1',
        timestamp: now,

        // Converting raw data to physical units
        // Accelerometer in m/s^2
        accelerometer: {
          x: accelBuffer.readInt16LE(2) * ACCEL_SENSIVITY * GRAV_TO_M_S_2, // Swapping the x and y axes
          y: accelBuffer.readInt16LE(0) * ACCEL_SENSIVITY * GRAV_TO_M_S_2,
          z: accelBuffer.readInt16LE(4) * ACCEL_SENSIVITY * GRAV_TO_M_S_2,
          timestamp: now,
          frequency: 1000 / (this.#config.interval || DEFAULT_INTERVAL_MS),
        },

        // Gyroscope in rad/s
        gyroscope: {
          x: gyroBuffer.readInt16LE(2) * GYRO_SENSIVITY * DEG_TO_RAD, // Swapping the x and y axes
          y: gyroBuffer.readInt16LE(0) * GYRO_SENSIVITY * DEG_TO_RAD,
          z: gyroBuffer.readInt16LE(4) * GYRO_SENSIVITY * DEG_TO_RAD,
          timestamp: now,
          frequency: 1000 / (this.#config.interval || DEFAULT_INTERVAL_MS),
        },

        // Magnetometer in µT
        magnetometer: {
          x: magnetoBuffer.readInt16LE(2) * MAGNETO_SENSIVITY * GAUSS_TO_UT, // Swapping the x and y axes
          y: magnetoBuffer.readInt16LE(0) * MAGNETO_SENSIVITY * GAUSS_TO_UT,
          z: magnetoBuffer.readInt16LE(4) * MAGNETO_SENSIVITY * GAUSS_TO_UT,
          timestamp: now,
          frequency: 1000 / (this.#config.interval || DEFAULT_INTERVAL_MS),
        },
      };

      data.gravity = this.#gravityProcessor(data);

      clearTimeout(this.#activeTimeoutId);

      if (!this.state.get('active')) {
        this.state.set({ active: true });
      }

      this.#activeTimeoutId = setTimeout(() => {
        this.state.set({ active: false });
      }, this.#activeTimeoutPeriod);


      this.state.set({ frame: [data] });

      //console.log('[Frame sent:', JSON.stringify(data, null, 2));

    } catch (err) {
      console.error('Reading error:', err.message);
    }

  };
}

export default Lsm9ds1Source;
