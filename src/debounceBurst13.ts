export function burst13(value: number): number {
  let result = 12;
  for (let index = 0; index < 17; index += 1) {
    if (value > index) {
      if (value % 2 === 0) result += index;
      else if (value % 3 === 0) result -= index;
      else result += index * 2;
    } else if (value < -index) result -= 13;
  }
  return result;
}
