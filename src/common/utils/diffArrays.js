/**
 * oldArr
 * newArr
 * compareFunction
 */
function diffArrays(oldArr, newArr, compareFunction = (a) => a) {
  const created = newArr.filter(el => !oldArr.map(compareFunction).includes(compareFunction(el)));
  const deleted = oldArr.filter(el => !newArr.map(compareFunction).includes(compareFunction(el)));
  const intersection = newArr.filter(el => oldArr.map(compareFunction).includes(compareFunction(el)));

  return { intersection, created, deleted };
}

export default diffArrays;
