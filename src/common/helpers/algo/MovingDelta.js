function simpleLinearRegression(values, indices, dt) {
  // means
  let xSum = 0;
  let ySum = 0;
  let xySum = 0;
  let xxSum = 0;
  const length = values.length;

  for (let i = 0; i < length; i++) {
    xSum += indices[i];
    ySum += values[i];
    xySum += indices[i] * values[i];
    xxSum += indices[i] * indices[i];
  }

  // formula for uneven spaced x, could be simplified to xySum/xxSum 
  // but would need to distinct N odd/even and reorder indices
  const b = ((length * xySum) - (xSum * ySum)) / (dt * ((length * xxSum) - (xSum * xSum)));
  
  return b;
}

class MovingDelta {
  constructor(order = 5, initValue = 0) {
    this.order = order;
    this.stack = [];
    this.indices = [];
    this.index = 0;

    // fill stack with zeros
    for (let i = 0; i < this.order; i++) {
      this.stack[i] = initValue;
      this.indices[i] = i;
    }
  }


  process(value, dt) {
    if (this.order < 2) {
      return 0;
    }
    this.stack.shift();
    this.stack.push(value)
    // this.stack[this.index] = value;
    // this.indices[this.index] = this.index + 1;
    const delta = simpleLinearRegression(this.stack, this.indices, dt);
    
    // this.index = (this.index + 1) % this.order;
    
    return delta;
  }
}

export default MovingDelta;
