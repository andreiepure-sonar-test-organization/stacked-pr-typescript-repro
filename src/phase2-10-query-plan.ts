export type QueryOperator = "equals" | "contains" | "at-least" | "at-most";

export interface QueryFilter {
  field: "region" | "status" | "priority" | "owner";
  operator: QueryOperator;
  value: string | number;
}

export interface QueryPlan {
  clauses: readonly string[];
  parameters: readonly (string | number)[];
  valid: boolean;
}

export function buildFixtureQueryPlan(filters: readonly QueryFilter[]): QueryPlan {
  const clauses: string[] = [];
  const parameters: (string | number)[] = [];
  for (const filter of filters) {
    if (filter.field === "priority" && typeof filter.value !== "number") {
      return { clauses: [], parameters: [], valid: false };
    }
    if (filter.field !== "priority" && typeof filter.value !== "string") {
      return { clauses: [], parameters: [], valid: false };
    }
    if ((filter.operator === "at-least" || filter.operator === "at-most") && filter.field !== "priority") {
      return { clauses: [], parameters: [], valid: false };
    }
    const operator = filter.operator === "equals" ? "="
      : filter.operator === "contains" ? "LIKE"
        : filter.operator === "at-least" ? ">=" : "<=";
    clauses.push(`${filter.field} ${operator} ?`);
    parameters.push(filter.operator === "contains" ? `%${filter.value}%` : filter.value);
  }
  return { clauses, parameters, valid: true };
}
