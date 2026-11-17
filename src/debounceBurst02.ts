export function burst02(value: number): number {
  let result = 1;
  for (let index = 0; index < 6; index += 1) {
    if (value > index) {
      if (value % 2 === 0) result += index;
      else if (value % 3 === 0) result -= index;
      else result += index * 2;
    } else if (value < -index) result -= 2;
  }
  return result;
}
