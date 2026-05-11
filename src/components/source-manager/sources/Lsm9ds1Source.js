import AbstractSource from './AbstractSource.js';
import { getTime } from '@ircam/sc-utils';


// Import conditionnel : i2c n'existe que sur Linux
// Sur Mac, on n'importe pas le module pour ne pas faire planter le serveur
let I2C = null;
if (process.platform === 'linux') {
  const module = await import('i2c');
  I2C = module.default;
}


// ------------ Adresses I2C du gyroscope/accéléromètre et du magnétomètre -----------------
const LSM9DS1_GYRO_ACCEL_ADDRESS = 0x6B; // Adresse I2C du gyroscope et de l'accéléromètre
const LSM9DS1_MAGNETO_ADDRESS       = 0x1E; // Adresse I2C du magnétomètre


const GYRO_ACCEL_REGISTER = {
  //------ Registres généraux ----
  WHO_AM_I:     0x0F, // Registre d'identification du gyroscope/accéléromètre (== 0x68 par default)
  CTRL_REG8:    0x22, // Auto-incrémentation des adresses

  // --- Registre du gyroscope -----
  CTRL_REG1_G:  0x10, // ODR (Hz), Précision gyroscope (dps)
  OUT_X_G:      0x18, // Premier registre de sortie du gyroscope (OUT_X_L_G / X Low)

  // ---- Registre de l'accéléromètre ---
  CTRL_REG6_XL: 0x20, // ODR (Hz), Précision accéléromètre (g)
  OUT_X_XL:     0x28, // Premier registre de sortie de l'accéléromètre (OUT_X_L_XL / X Low)
};


// --------------------- Registres du magnétomètre --------------------
const MAGNETO_REGISTER = {
  WHO_AM_I_M:   0x0F, // Registre d'identification du magnétomètre (== 0x3D par default)
  CTRL_REG1_M:  0x20, // ODR (Hz), mode de performance XY, compensation température
  CTRL_REG2_M:  0x21, // Précision magnétomètre (gauss)
  CTRL_REG3_M:  0x22, // Mode continu
  CTRL_REG4_M:  0x23, // Mode de performance axe Z
  OUT_X_M:      0x28, // Premier registre de sortie du magnétomètre (OUT_X_L_M / X Low)
};



// ---------------------- Sensibilités des capteurs ------------------------------------
const ACCEL_SENSIVITY = 0.000061; // g/LSB ---> ±2g
const GYRO_SENSIVITY = 0.00875;     // dps/LSB --->  ±245 dps
const MAGNETO_SENSIVITY = 0.00014; // gauss/LSB  ---->  ±4 gauss



// ---------------------- Coefficients pour la conversion des unités -----------------------------------
const GAUSS_TO_UT = 100;   // ---> 1 gauss = 0.0001 Tesla (T) soit 100 microTesla (uT)
const DEG_TO_RAD = Math.PI / 180;
const GRAV_TO_M_S_2 = 9.81;    // --->  1g = 9,81 m/s^2


// ------ Fréquence de lecture -------
const DEFAULT_INTERVAL_MS = 10; // Par défaut 100 Hz
const DEFAULT_ACTIVE_TIMEOUT_MS= 500;


//------------------------------------------------------------

class Lsm9ds1Source extends AbstractSource {
  static type = 'lsm9ds1';

  #config = null;

  #Gyro_Accel_Wire = null;
  #Magneto_Wire = null;
  #intervalId = null;

  #activeTimeoutId = null;
  #activeTimeoutPeriod = null;


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



  // ----------------------- Ouverture d'une connexion I2C -------------------------------
  #openWire(address) {
    return new Promise((resolve, reject) => {
      const wire = new I2C(address, { device: '/dev/i2c-1' });
      wire.on('open', () => resolve(wire));
      wire.on('error', (err) => reject(new Error(`I2C open 0x${address.toString(16)}: ${err}`)));
    });
  }


  //--------- Lecture dans un registre ------------
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


  //--------- Ecriture dans un registre ------------
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


  //---------------------- Initialisation du capteur ------------------------------
  async #initSensor() {

    if (I2C === null) {
      console.warn('The I2C module is not available on this platform; the sensor is disabled.');
      return;
    }

    this.#Gyro_Accel_Wire = await this.#openWire(LSM9DS1_GYRO_ACCEL_ADDRESS);
    this.#Magneto_Wire = await this.#openWire(LSM9DS1_MAGNETO_ADDRESS);


    // Vérification WHO_AM_I Gyroscope/Magnétomètre (doit retourner 0x68)
    const Gyro_Accel_Id = await this.#readRegister(this.#Gyro_Accel_Wire, GYRO_ACCEL_REGISTER.WHO_AM_I, 1);
    if (Gyro_Accel_Id[0] !== 0x68) {
      throw new Error(`LSM9DS1 gyroscope and accelerometer not detected (WHO_AM_I=0x${Gyro_Accel_Id[0].toString(16)}, attendu 0x68)`);
    }
    console.log('LSM9DS1 gyroscope and accelerometer identified');


    // Vérification WHO_AM_I Magnétomètre (doit retourner 0x3D)
    const Magneto_Id = await this.#readRegister( this.#Magneto_Wire, MAGNETO_REGISTER.WHO_AM_I_M, 1);
    if (Magneto_Id[0] !== 0x3D) {
      throw new Error(`LSM9DS1 magnetometer not detected (WHO_AM_I=0x${Magneto_Id [0].toString(16)}, attendu 0x3D)`);
    }
    console.log('LSM9DS1 Magnetometer identified');


    // ------------ Configuration Gyroscope et Magnétomètre --------------
    await this.#writeRegister(this.#Gyro_Accel_Wire, GYRO_ACCEL_REGISTER.CTRL_REG8, 0x04); // auto-incrémentation d'adresse
    await this.#writeRegister(this.#Gyro_Accel_Wire, GYRO_ACCEL_REGISTER.CTRL_REG1_G, 0x80); // Gyroscope: ODR 238 Hz, ±245 dps
    await this.#writeRegister(this.#Gyro_Accel_Wire, GYRO_ACCEL_REGISTER.CTRL_REG6_XL, 0x80);  //Accéléromètre: ODR 238 Hz, ±2g


    // ------------ Configuration Magnétomètre --------------
    await this.#writeRegister(this.#Magneto_Wire, MAGNETO_REGISTER.CTRL_REG1_M, 0xFC); // ultra-haute perf. XY, ODR 80 Hz, Compensation Temperature
    await this.#writeRegister(this.#Magneto_Wire, MAGNETO_REGISTER.CTRL_REG2_M, 0x00); // ±4 gauss
    await this.#writeRegister(this.#Magneto_Wire, MAGNETO_REGISTER.CTRL_REG3_M, 0x00); // mode continu
    await this.#writeRegister(this.#Magneto_Wire, MAGNETO_REGISTER.CTRL_REG4_M, 0x0C); // ultra-haute perf. Z


    console.log('LSM9DS1 sensor initialized');

  }



  //------------------ Lectures des données du capteur ------------------------
  #readSensor = async () => {

    if (this.#Gyro_Accel_Wire === null || this.#Magneto_Wire === null) {
      return;
    }


    try {
      const Gyro_Buffer = await this.#readRegister(this.#Gyro_Accel_Wire, GYRO_ACCEL_REGISTER.OUT_X_G, 6);
      const Accel_Buffer = await this.#readRegister(this.#Gyro_Accel_Wire, GYRO_ACCEL_REGISTER.OUT_X_XL, 6);
      const Magneto_Buffer = await this.#readRegister(this.#Magneto_Wire, MAGNETO_REGISTER.OUT_X_M, 6);

      const now = getTime() * 1e3; // millisecondes


      const data = {
        source: Lsm9ds1Source.type,
        api: 'v3',
        id: this.#config.id || 'lsm9ds1',
        timestamp: now,

        // Conversion des données brutes en unités physiques
        // Accéléromètre en m/s^2
        accelerometer: {
          x: Accel_Buffer.readInt16LE(2) * ACCEL_SENSIVITY * GRAV_TO_M_S_2, // Inversion des axes x et y
          y: Accel_Buffer.readInt16LE(0) * ACCEL_SENSIVITY * GRAV_TO_M_S_2,
          z: Accel_Buffer.readInt16LE(4) * ACCEL_SENSIVITY * GRAV_TO_M_S_2,
          timestamp: now,
          frequency: 1000 / (this.#config.interval || DEFAULT_INTERVAL_MS),
        },

        // Gyroscope en rad/s
        gyroscope: {
          x: Gyro_Buffer.readInt16LE(2) * GYRO_SENSIVITY * DEG_TO_RAD, // Inversion des axes x et y
          y: Gyro_Buffer.readInt16LE(0) * GYRO_SENSIVITY * DEG_TO_RAD,
          z: Gyro_Buffer.readInt16LE(4) * GYRO_SENSIVITY * DEG_TO_RAD,
          timestamp: now,
          frequency: 1000 / (this.#config.interval || DEFAULT_INTERVAL_MS),
        },

        // Magnétomètre en uT
        magnetometer: {
          x: Magneto_Buffer.readInt16LE(2) * MAGNETO_SENSIVITY * GAUSS_TO_UT, // Inversion des axes x et y
          y: Magneto_Buffer.readInt16LE(0) * MAGNETO_SENSIVITY * GAUSS_TO_UT,
          z: Magneto_Buffer.readInt16LE(4) * MAGNETO_SENSIVITY * GAUSS_TO_UT,
          timestamp: now,
          frequency: 1000 / (this.#config.interval || DEFAULT_INTERVAL_MS),
        },
      };


      clearTimeout(this.#activeTimeoutId);

      if (!this.state.get('active')) {
        this.state.set({ active: true });
      }

      this.#activeTimeoutId = setTimeout(() => {
        this.state.set({ active: false });
      }, this.#activeTimeoutPeriod);


      this.state.set({ frame: [data] });

      //console.log('[Frame envoyé:', JSON.stringify(data, null, 2));

    } catch (err) {
      console.error('Reading error:', err.message);
    }

  };
}

export default Lsm9ds1Source;
