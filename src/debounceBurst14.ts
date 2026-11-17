export function burst14(value: number): number {
  let result = 13;
  for (let index = 0; index < 18; index += 1) {
    if (value > index) {
      if (value % 2 === 0) result += index;
      else if (value % 3 === 0) result -= index;
      else result += index * 2;
    } else if (value < -index) result -= 14;
  }
  return result;
}
