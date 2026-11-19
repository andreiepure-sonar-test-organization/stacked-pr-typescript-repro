export type PageDirection = "forward" | "backward";

export interface PageRequest {
  totalItems: number;
  pageSize: number;
  pageNumber: number;
  direction: PageDirection;
}

export interface PageSelection {
  start: number;
  endExclusive: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export function selectFixturePage(request: PageRequest): PageSelection {
  const valid = Number.isInteger(request.totalItems) && request.totalItems >= 0
    && Number.isInteger(request.pageSize) && request.pageSize > 0
    && Number.isInteger(request.pageNumber) && request.pageNumber >= 0;
  if (!valid) {
    return { start: 0, endExclusive: 0, hasPrevious: false, hasNext: false };
  }
  const lastPage = Math.max(0, Math.ceil(request.totalItems / request.pageSize) - 1);
  const requestedPage = request.direction === "backward" ? request.pageNumber - 1 : request.pageNumber;
  const page = Math.max(0, Math.min(lastPage, requestedPage));
  const start = page * request.pageSize;
  const endExclusive = Math.min(request.totalItems, start + request.pageSize);
  return { start, endExclusive, hasPrevious: page > 0, hasNext: endExclusive < request.totalItems };
}
