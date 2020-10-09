
class MovingMedian {
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

    const orderedStack = this.stack.sort(function(a, b){return a - b}); 
	  const median = 0;
	
	  if (order > 1) {
		  if (order % 2) {
    		median = orderedStack[(order - 1) / 2];  //odd order

		  } else {
			median = (orderedStack[(order / 2) - 1] + orderedStack[order  / 2]) / 2;  //even order
  		}
		
	  } else {
		median = value;
	}

	return median;
  }
}

export default MovingMedian;


