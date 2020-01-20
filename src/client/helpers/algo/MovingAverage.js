
class MovingAverage {
  constructor(order = 5, initValue = 0) {
    this.order = order;
    this.stack = [];
    this.index = 0;

    // fill stack with zeros
    for (let i = 0; i < this.order; i++) {
      this.stack[i] = initValue;
    }
  }

  process(value) {
    this.stack[this.index] = value;
    this.index = (this.index + 1) % this.order;

    let sum = 0;

    for (let i = 0; i < this.order; i++) {
      sum += this.stack[i];
    }

    const mean = sum / this.order;

    return mean;
  }
}

export default MovingAverage;
