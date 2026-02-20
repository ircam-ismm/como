# R-IoT format

Since version 3, R-IoT follows the unified [v3](./v3) format.

Before that format changed over time.

## R-IoT Bitalino version 2

22 float-32 values in a single `/raw` message:

```
/${id}/raw ffffffffffffffffffffff [
   acceleration_y, -acceleration_x, acceleration_z, // in g/s/s
   gyroscope_alpha, -gyroscope_beta, gyroscope_gamma, // in deg/ms
   -magnetometer_y, -magnetometer_x, magnetometer_z, // in gauss
   temperature, // in (°C - 21)*8
   button_onboard, button_external, // in {0, 1}
   analog_input_0, analog_input_1, // in [0, 4095]
   quaternion w, x, y, z, // as [q0, q1, q2, q3]
   euler_angle alpha, beta, gamma, // in deg
   heading // in [-180, 180] deg
]
```

## R-IoT Ircam version 2

20 float-32 values in a single `/raw` message:

```
/${id}/raw ffffffffffffffffffff [
   battery, // in [3.5, 3.9] V*877
   button_onboard, // in {0,1}
   -acceleration_y, acceleration_x, -acceleration_z, // in g/s/s
   -gyroscope_alpha, gyroscope_beta, -gyroscope_gamma, // in deg/ms
   magnetometer_y, magnetometer_x, -magnetometer_z, // in gauss
   temperature, // in (°C - 21)*8
   quaternion w, x, y, z, // as [q0, q1, q2, q3]
   euler_angle alpha, beta, gamma, // in deg
   heading // in [-180, 180] deg
   analog_input_0, analog_input_1, // in [0, 4095]
]
```

## R-IoT Ircam version 1

All values are 32-bit floats.

- 12 values in `/raw` message
- 4 values in `/quat` message
- 3 values in `euler` message

```
/${id}/raw ffffffffffff [
   battery, // in [3.5, 3.9] V*877
   button_onboard, // in {0,1}
   -acceleration_y, acceleration_x, -acceleration_z, // in g/4096
   -gyroscope_alpha, gyroscope_beta, -gyroscope_gamma, // in deg/ms/16384
   magnetometer_y, magnetometer_x, -magnetometer_z, // in gauss/0.886e-4
   ???
]

/${id}/quat ffff [w, x, y, z] // as [q0, q1, q2, q3]
/${id}/euler fff [1, 2, 3]
```
