export function burst08(value: number): number {
  let result = 7;
  for (let index = 0; index < 12; index += 1) {
    if (value > index) {
      if (value % 2 === 0) result += index;
      else if (value % 3 === 0) result -= index;
      else result += index * 2;
    } else if (value < -index) result -= 8;
  }
  return result;
}
