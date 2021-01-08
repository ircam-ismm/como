function simpleLinearRegression(values, dt) {
  // means
  let xSum = 0;
  let ySum = 0;
  const length = values.length;

  for (let i = 0; i < length; i++) {
    xSum += i * dt;
    ySum += values[i];
  }

  const xMean = xSum / length;
  const yMean = ySum / length;

  let sumDiffXMeanSquared = 0; // sum[ pow((x - xMean), 2) ]
  let sumDiffYMeanSquared = 0; // sum[ pow((y - yMean), 2) ]
  let sumDiffXYMean = 0;       // sum[ (x - xMean)(y - yMean) ]

  for (let i = 0; i < length; i++) {
    const diffXMean = dt * i - xMean;
    const diffYMean = values[i] - yMean;

    const diffXMeanSquared = diffXMean * diffXMean;
    const diffYMeanSquared = diffYMean * diffYMean;
    const diffXYMean = diffXMean * diffYMean;

    sumDiffXMeanSquared += diffXMeanSquared;
    sumDiffYMeanSquared += diffYMeanSquared;
    sumDiffXYMean += diffXYMean;
  }

  // horizontal line, all y on same line
  if (sumDiffYMeanSquared === 0) {
    return 0;
  }

  // Pearson correlation coefficient:
  // cf. https://www.youtube.com/watch?v=2SCg8Kuh0tE
  //
  //                 ∑ [ (x - xMean)(y - yMean) ]
  // r = ------------------------------------------------------
  //     sqrt( ∑ [ pow((x - xMean), 2), pow((y - yMean), 2) ] )
  //
  //
  const r = sumDiffXYMean / Math.sqrt(sumDiffXMeanSquared * sumDiffYMeanSquared);

  // then we have:
  // cf. https://www.youtube.com/watch?v=GhrxgbQnEEU
  //
  // y = a + bx
  // where:
  //         Sy
  // b = r * --
  //         Sx
  //
  // a = yMean - b * xMean
  //
  // S for standard deviation
  //            ∑ [ pow((x - xMean), 2) ]
  // Sx = sqrt( -------------------------  )
  //                      N - 1
  const Sx = Math.sqrt(sumDiffXMeanSquared / (length - 1));
  const Sy = Math.sqrt(sumDiffYMeanSquared / (length - 1));
  const b = r * (Sy / Sx);

  return b;
}

class MovingDelta {
  constructor(order = 5, initValue = 0) {
    this.order = order;
    this.stack = [];
    this.index = 0;

    // fill stack with zeros
    for (let i = 0; i < this.order; i++) {
      this.stack[i] = initValue;
    }
  }


  process(value, dt) {
    if (this.order < 2) {
      return 0;
    }

    this.stack[this.index] = value;
    this.index = (this.index + 1) % this.order;
 
    const delta = simpleLinearRegression(this.stack, dt);
    
    return delta;
  }
}

export default MovingDelta;
