
class MovingMedian {
  constructor(order = 5, initValue = 0) {
    this.order = order;
    this.stack = [];
    this.orderedStack = [];
    this.index = 0;

    // fill stack with initValue
    for (let i = 0; i < this.order; i++) {
      this.stack[i] = initValue;
    }
  }

  process(value) {
    this.stack[this.index] = value;
    this.index = (this.index + 1) % this.order;

    for (let i = 0; i < this.order; i++) {
      this.orderedStack[i] = this.stack[i];
    }

    this.orderedStack.sort((a, b) => a - b);

    let median = 0;

    if (this.order > 1) {
      if (this.order % 2 === 1) { // odd order
        median = this.orderedStack[(this.order - 1) / 2];
      } else { // even order
        median = (this.orderedStack[(this.order / 2) - 1] + this.orderedStack[this.order  / 2]) / 2;
      }
    } else {
      median = value;
    }

    return median;
  }
}

export default MovingMedian;
