
export function copyFrameData(input, output) {
  for (let name in input) {
    if (Array.isArray(input[name])) {
      if (!output[name]) {
        output[name] = [];
      }

      output[name] = input[name].slice(0);
      // output[name] = output[name].concat(input[name]);
    // handle objects
    } else if (Object.prototype.toString.call(input[name]) === '[object Object]') {
      if (!output[name]) {
        output[name] = {};
      }

      for (let key in input[name]) {
        output[name][key] = input[name][key];
      }
    // consider everything else as a scalar
    } else {
      output[name] = input[name];
    }
  }
}
