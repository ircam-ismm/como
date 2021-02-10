// using Welford’s method, eg  https://jonisalonen.com/2013/deriving-welfords-method-for-computing-variance/
// std computed with 1 dof (divided by N-1)
class MovingMeanStd {
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
    if (this.order < 2){
      return 0;
    }

    this.stack[this.index] = value;
    this.index = (this.index + 1) % this.order;
 
    let mean = 0; // mean
    let v = 0; // variance * (N-1)
    let oldMean = 0;

    for (let i = 0; i < this.order; i++) {
      let x = this.stack[i];

      oldMean = mean;
      mean = oldMean + (x-oldMean)/(i + 1);
      v = v + (x-mean)*(x-oldMean);
    }  
    const std = Math.pow(v/(this.order-1), 0.5);

    return [mean, std]
  }
}

export default MovingMeanStd;
