
class MovingStd {
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

    //const std = math.std(this.stack);
    let sum = 0;
    let sumSquare = 0;

    for (let i = 0; i < this.order; i++) {
      sum += this.stack[i];
      sumSquare += pow(this.stack[i],2);
    }

    const std = pow(((this.order*sum - sumSquare)/ (this.order*(this.order-1))),0.5); 
    
    return std;
  }
}

export default MovingStd;
