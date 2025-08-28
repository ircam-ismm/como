// 10ms -> 0.01s -> 100Hz between the 2 frames to estimate frequency
export const oscBundleNoFreq0 = {
  timetag: [ 0, 0 ],
  elements: [
    // ok
    [
      '/riot/v3/0/accelerometer',
      0.9457096457481384,
      0.17717093229293823,
      -9.801861763000488,
      367050
    ],
    // ok
    [
      '/riot/v3/0/gyroscope',
      0.004261057823896408,
      0.006391586735844612,
      -0.001065264455974102,
      367050
    ],
    // ok
    [
      '/riot/v3/0/magnetometer',
      5.853090286254883,
      29.031557083129883,
      40.957332611083984,
      367050
    ],
    // ok
    [
      '/riot/v3/0/barometer',
      1013.2235107421875,
      0.22183935344219208,
      367050
    ],
    // not in spec, drop
    [
      '/riot/v3/0/temperature',
      47.40234375,
      50.2486457824707,
      56.70000076293945,
      367050
    ],
    // ok
    [
      '/riot/v3/0/absoluteorientation/quaternion',
      -0.9837159514427185,
      0.17317603528499603,
      -0.017230689525604248,
      0.047567401081323624,
      367050
    ],
    // ok
    [
      '/riot/v3/0/absoluteorientation/euler',
      18.193050384521484,
      178.9970703125,
      -5.7134599685668945,
      367050
    ],
    // ok
    [
      '/riot/v3/0/gravity',
      0.9762864708900452,
      0.17088225483894348,
      -9.758878707885742,
      367050
    ],
    // ok
    [ '/riot/v3/0/heading', 198.3231964111328, -1, -1, 367050 ],
    // not in spec, drop ?
    [ '/riot/v3/0/bno055/euler', 44.25, 177, -4.6875, 367050 ],
    // not in spec, drop ?
    [
      '/riot/v3/0/bno055/quaternion',
      -0.92510986328125,
      0.3765869140625,
      -0.03936767578125,
      0.0284423828125,
      367050
    ],
    [ '/riot/v3/0/battery', 1, 0, 367047 ],
    // not in spec, drop
    [
      '/riot/v3/0/analog',
      3.877619743347168,
      0.4326394200325012,
      0.045116957277059555,
      367047
    ],
    [ '/riot/v3/0/control/key', 0, 0, 367047 ]
  ],
  oscType: 'bundle'
};

export const oscBundleNoFreq1 = {
  timetag: [ 0, 0 ],
  elements: [
    [
      '/riot/v3/0/accelerometer',
      0.9457096457481384,
      0.17717093229293823,
      -9.801861763000488,
      367060
    ],
    [
      '/riot/v3/0/gyroscope',
      0.004261057823896408,
      0.006391586735844612,
      -0.001065264455974102,
      367060
    ],
    [
      '/riot/v3/0/magnetometer',
      5.853090286254883,
      29.031557083129883,
      40.957332611083984,
      367060
    ],
    [
      '/riot/v3/0/barometer',
      1013.2235107421875,
      0.22183935344219208,
      367060
    ],
    // not in spec, drop
    // [
    //   '/riot/v3/0/temperature',
    //   47.40234375,
    //   50.2486457824707,
    //   56.70000076293945,
    //   367060
    // ],
    [
      '/riot/v3/0/absoluteorientation/quaternion',
      -0.9837159514427185,
      0.17317603528499603,
      -0.017230689525604248,
      0.047567401081323624,
      367060
    ],
    [
      '/riot/v3/0/absoluteorientation/euler',
      18.193050384521484,
      178.9970703125,
      -5.7134599685668945,
      367060
    ],
    [
      '/riot/v3/0/gravity',
      0.9762864708900452,
      0.17088225483894348,
      -9.758878707885742,
      367060
    ],
    [ '/riot/v3/0/heading', 198.3231964111328, -1, -1, 367060 ],
    // not in spec, replace absoluteorientation if useBno55 = true
    [ '/riot/v3/0/bno055/euler', 44.25, 177, -4.6875, 367060 ],
    // not in spec, replace absoluteorientation if useBno55 = true
    [
      '/riot/v3/0/bno055/quaternion',
      -0.92510986328125,
      0.3765869140625,
      -0.03936767578125,
      0.0284423828125,
      367060
    ],
    [ '/riot/v3/0/battery', 1, 0, 367047 ],
    // not in spec, drop
    // [
    //   '/riot/v3/0/analog',
    //   3.877619743347168,
    //   0.4326394200325012,
    //   0.045116957277059555,
    //   367047
    // ],
    [ '/riot/v3/0/control/key', 0, 0, 367047 ]
  ],
  oscType: 'bundle'
};

export const oscBundleFull = {
  timetag: [ 0, 0 ],
  elements: [
    [
      '/riot/v3/0/accelerometer',
      0.9457096457481384,
      0.17717093229293823,
      -9.801861763000488,
      367060,
      100,
    ],
    [
      '/riot/v3/0/gyroscope',
      0.004261057823896408,
      0.006391586735844612,
      -0.001065264455974102,
      367060,
      100,
    ],
    [
      '/riot/v3/0/magnetometer',
      5.853090286254883,
      29.031557083129883,
      40.957332611083984,
      367060,
      100,
    ],
    [
      '/riot/v3/0/barometer',
      1013.2235107421875,
      0.22183935344219208,
      367060,
      100,
    ],
    // not in spec, drop
    // [
    //   '/riot/v3/0/temperature',
    //   47.40234375,
    //   50.2486457824707,
    //   56.70000076293945,
    //   367060
    // ],
    [
      '/riot/v3/0/absoluteorientation/quaternion',
      -0.9837159514427185,
      0.17317603528499603,
      -0.017230689525604248,
      0.047567401081323624,
      367060,
      100,
    ],
    [
      '/riot/v3/0/absoluteorientation/euler',
      18.193050384521484,
      178.9970703125,
      -5.7134599685668945,
      367060,
      100,
    ],
    [
      '/riot/v3/0/gravity',
      0.9762864708900452,
      0.17088225483894348,
      -9.758878707885742,
      367060,
      100,
    ],
    [ '/riot/v3/0/heading', 198.3231964111328, -1, -1, 367060, 100, ],
    // not in spec, replace absoluteorientation if useBno55 = true
    [ '/riot/v3/0/bno055/euler', 44.25, 177, -4.6875, 367060, 100, ],
    // not in spec, replace absoluteorientation if useBno55 = true
    [
      '/riot/v3/0/bno055/quaternion',
      -0.92510986328125,
      0.3765869140625,
      -0.03936767578125,
      0.0284423828125,
      367060,
      100,
    ],
    [ '/riot/v3/0/battery', 1, 0, 367047, 100 ],
    // not in spec, drop
    // [
    //   '/riot/v3/0/analog',
    //   3.877619743347168,
    //   0.4326394200325012,
    //   0.045116957277059555,
    //   367047
    // ],
    [ '/riot/v3/0/control/key', 0, 0, 367047 ]
  ],
  oscType: 'bundle'
};

export const jsonFrame = {
  source: 'riot',
  format: 'v3',
  id: '0',
  timestamp: 367060,
  accelerometer: {
    x: 0.9457096457481384,
    y: 0.17717093229293823,
    z: -9.801861763000488,
    timestamp: 367060,
    frequency: 100
  },
  gyroscope: {
    x: 0.004261057823896408,
    y: 0.006391586735844612,
    z: -0.001065264455974102,
    timestamp: 367060,
    frequency: 100
  },
  magnetometer: {
    x: 5.853090286254883,
    y: 29.031557083129883,
    z: 40.957332611083984,
    timestamp: 367060,
    frequency: 100
  },
  barometer: {
    pressure: 1013.2235107421875,
    relativeAltitude: 0.22183935344219208,
    timestamp: 367060,
    frequency: 100
  },
  absoluteorientation: {
    quaternion: {
      x: -0.9837159514427185,
      y: 0.17317603528499603,
      z: -0.017230689525604248,
      w: 0.047567401081323624,
      timestamp: 367060,
      frequency: 100
    },
    euler: {
      alpha: 18.193050384521484,
      beta: 178.9970703125,
      gamma: -5.7134599685668945,
      timestamp: 367060,
      frequency: 100
    }
  },
  gravity: {
    x: 0.9762864708900452,
    y: 0.17088225483894348,
    z: -9.758878707885742,
    timestamp: 367060,
    frequency: 100
  },
  heading: {
    magnetic: 198.3231964111328,
    geographic: -1,
    accuracy: -1,
    timestamp: 367060,
    frequency: 100
  },
  battery: {
    level: 1,
    charging: 0,
    timestamp: 367047,
    frequency: 100,
   },
  control: {
    key: [ 0, 0 ],
    timestamp: 367047
  }
};

export const jsonFrameBno055 = {
  source: 'riot',
  format: 'v3',
  id: '0',
  timestamp: 367060,
  accelerometer: {
    x: 0.9457096457481384,
    y: 0.17717093229293823,
    z: -9.801861763000488,
    timestamp: 367060,
    frequency: 100
  },
  gyroscope: {
    x: 0.004261057823896408,
    y: 0.006391586735844612,
    z: -0.001065264455974102,
    timestamp: 367060,
    frequency: 100
  },
  magnetometer: {
    x: 5.853090286254883,
    y: 29.031557083129883,
    z: 40.957332611083984,
    timestamp: 367060,
    frequency: 100
  },
  barometer: {
    pressure: 1013.2235107421875,
    relativeAltitude: 0.22183935344219208,
    timestamp: 367060,
    frequency: 100
  },
  absoluteorientation: {
    quaternion: {
      x: -0.92510986328125,
      y: 0.3765869140625,
      z: -0.03936767578125,
      w: 0.0284423828125,
      timestamp: 367060,
      frequency: 100
    },
    euler: {
      alpha: 44.25,
      beta: 177,
      gamma: -4.6875,
      timestamp: 367060,
      frequency: 100
    }
  },
  gravity: {
    x: 0.9762864708900452,
    y: 0.17088225483894348,
    z: -9.758878707885742,
    timestamp: 367060,
    frequency: 100
  },
  heading: {
    magnetic: 198.3231964111328,
    geographic: -1,
    accuracy: -1,
    timestamp: 367060,
    frequency: 100
  },
  battery: {
    level: 1,
    charging: 0,
    timestamp: 367047,
    frequency: 100,
   },
  control: {
    key: [ 0, 0 ],
    timestamp: 367047
  }
};
