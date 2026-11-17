export function burst05(value: number): number {
  let result = 4;
  for (let index = 0; index < 9; index += 1) {
    if (value > index) {
      if (value % 2 === 0) result += index;
      else if (value % 3 === 0) result -= index;
      else result += index * 2;
    } else if (value < -index) result -= 5;
  }
  return result;
}
