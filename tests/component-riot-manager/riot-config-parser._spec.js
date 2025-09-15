import { assert } from 'chai';
import { parseRiotConfig } from '../../src/utils/riot-config-parser.js';

const input = `
dhcp 1
ssid riot-cusson
mode 0
pass 12345678
mdns riot0-cusson
ownip 192.168.1.50
destip 192.168.1.100
gateway 192.168.1.1
mask 255.255.255.0
port 8002
rxport 9000
masterid 0
samplerate 10
power 8
remote 1
forceconfig 0
calibration 5000
charger 2
cpu 80
doze 80
declination 1.830000
orientation 0
bno_orient 1
accrange 8
gyrorange 2000
magrange 4
gyrogate 0.000000
gyrohpf 0
baromode 3
baroref 0.000000
slowboot 0
ledcolor [R]:0 - [G]:5 - [B]:10 - [W]:0
acc_offsetx 27
acc_offsety 52
acc_offsetz 176
gyr_offsetx 1
gyr_offsety -19
gyr_offsetz 18
mag_offsetx 509
mag_offsety -3751
mag_offsetz -607
soft_matrix1 [ 1.000000 -0.255186 0.002639 ]
soft_matrix2 [ -0.053004 1.000000 0.047845 ]
soft_matrix1 [ 0.002706 0.236243 1.000000 ]
beta 0.400000
refresh
`;

const expected = {
  dhcp: 1,
  ssid: 'riot-cusson',
  mode: 0,
  pass: '12345678',
  mdns: 'riot0-cusson',
  ownip: '192.168.1.50',
  destip: '192.168.1.100',
  gateway: '192.168.1.1',
  mask: '255.255.255.0',
  port: 8002,
  rxport: 9000,
  masterid: 0,
  samplerate: 10,
  power: 8,
  remote: 1,
  forceconfig: 0,
  calibration: 5000,
  charger: 2,
  cpu: 80,
  doze: 80,
  declination: 1.830000,
  orientation: 0,
  bno_orient: 1,
  accrange: 8,
  gyrorange: 2000,
  magrange: 4,
  gyrogate: 0.000000,
  gyrohpf: 0,
  baromode: 3,
  baroref: 0.000000,
  slowboot: 0,
  ledcolor: {
    R: 0,
    G: 5,
    B: 10,
    W: 0,
  },
  acc_offsetx: 27,
  acc_offsety: 52,
  acc_offsetz: 176,
  gyr_offsetx: 1,
  gyr_offsety: -19,
  gyr_offsetz: 18,
  mag_offsetx: 509,
  mag_offsety: -3751,
  mag_offsetz: -607,
  soft_matrix1: [ 1.000000, -0.255186, 0.002639 ],
  soft_matrix2: [ -0.053004, 1.000000, 0.047845 ],
  soft_matrix1: [ 0.002706, 0.236243, 1.000000 ],
  beta: 0.400000,
}

describe('# R-IoT config parser', () => {
  it('should parse riot config to JS object', () => {
    const result = parseRiotConfig(input);
    assert.deepEqual(result, expected);
  });
});
