export interface ProrationInput {
  totalMinorUnits: number;
  cycleDays: number;
  billableDays: number;
  creditMinorUnits: number;
  rounding: "up" | "down";
}

export interface ProrationSummary {
  proratedMinorUnits: number;
  creditMinorUnits: number;
  dueMinorUnits: number;
  valid: boolean;
}

export function summarizeFixtureProration(input: ProrationInput): ProrationSummary {
  const valid = Number.isSafeInteger(input.totalMinorUnits) && input.totalMinorUnits >= 0
    && Number.isInteger(input.cycleDays) && input.cycleDays > 0
    && Number.isInteger(input.billableDays) && input.billableDays >= 0 && input.billableDays <= input.cycleDays
    && Number.isSafeInteger(input.creditMinorUnits) && input.creditMinorUnits >= 0;
  if (!valid) {
    return { proratedMinorUnits: 0, creditMinorUnits: 0, dueMinorUnits: 0, valid: false };
  }
  const exactProration = input.totalMinorUnits * input.billableDays / input.cycleDays;
  const proratedMinorUnits = input.rounding === "up" ? Math.ceil(exactProration) : Math.floor(exactProration);
  const creditMinorUnits = Math.min(proratedMinorUnits, input.creditMinorUnits);
  return {
    proratedMinorUnits,
    creditMinorUnits,
    dueMinorUnits: proratedMinorUnits - creditMinorUnits,
    valid: true,
  };
}
