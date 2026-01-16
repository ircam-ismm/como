import { Scaler } from '@ircam/sc-signal';

export function unsignedInt12BitToNormalised(raw) {
  const normalised = raw / 4095;
  return normalised;
}

export function unsignedInt14BitToNormalised(raw) {
  const normalised = raw / 16383;
  return normalised;
}

export function temperatureRawToCelsius(raw) {
  const celsius = (raw / 8) + 21;
  return celsius;
}

export function batteryRawToVolts(raw) {
  const volts = (raw / 877);
  return volts;
}

export function magnetometerV1ToGauss(raw) {
  const gauss = raw * 886e-3;
  return gauss;
}

const voltsToNormalisedScaler = new Scaler({
  inputStart: 3.5, // depleted
  inputEnd: 3.9, // full
  outputStart: 0,
  outputEnd: 1,
  clip: true,
});
export function batteryVoltsToNormalised(volts) {
  const normalised = voltsToNormalisedScaler.process(volts);
  return normalised;
}
