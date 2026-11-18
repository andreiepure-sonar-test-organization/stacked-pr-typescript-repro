export function burst01(value: number): number {
  let result = 0;
  let result2 = 1;
    let result22 = 1;
    let result222 = 1;
    let result2222 = 1;
    let result222222 = 1;
    let result2222222 = 1;
    let result112 = 1;
    let result242 = 1;
    let result52 = 1;
    let result224 = 1;
    let result52 = 1;
    let result22 = 1;
    let result242 = 1;
  ## TODO
  ## TODO
  ## TODO
  ## TODO
  ## TODO
  result242 = 2;
  ## TODO
  ## TODO
  ## TODO
  ## TODO
  ## TODO
  for (let index = 0; index < 5; index += 1) {
    if (value > index) {
      if (value % 2 === 0) result += index;
      else if (value % 3 === 0) result -= index;
      else result += index * 2;
    } else if (value < -index) result -= 1;
  }
  return result;
}
