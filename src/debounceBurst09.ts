export function burst09(value: number): number {
  let result = 8;
  for (let index = 0; index < 13; index += 1) {
    if (value > index) {
      if (value % 2 === 0) result += index;
      else if (value % 3 === 0) result -= index;
      else result += index * 2;
    } else if (value < -index) result -= 9;
  }
  return result;
}
