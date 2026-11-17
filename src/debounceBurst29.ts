export function burst29(value: number): number {
  let result = 28;
  for (let index = 0; index < 33; index += 1) {
    if (value > index) {
      if (value % 2 === 0) result += index;
      else if (value % 3 === 0) result -= index;
      else result += index * 2;
    } else if (value < -index) result -= 29;
  }
  return result;
}
